//   █████╗ ██╗  ████████╗███████╗██████╗
//  ██╔══██╗██║  ╚══██╔══╝██╔════╝██╔══██╗
//  ███████║██║     ██║   █████╗  ██████╔╝
//  ██╔══██║██║     ██║   ██╔══╝  ██╔══██╗
//  ██║  ██║███████╗██║   ███████╗██║  ██║
//  ╚═╝  ╚═╝╚══════╝╚═╝   ╚══════╝╚═╝  ╚═╝
//


/**
 * Module dependencies
 */

var path = require('path');
var util = require('util');
var _ = require('@sailshq/lodash');
var async = require('async');
var flaverr = require('flaverr');
var informReFailedAlterStratagem = require('./private/inform-re-failed-alter-stratagem');


/**
 * runAlterStrategy()
 *
 * Perform non-destructive auto-migration: modify schema incrementally where safe,
 * warn about incompatibilities, and never drop data unless absolutely necessary.
 *
 * @param  {Ref}   orm
 * @param  {Function} cb
 */
module.exports = function runAlterStrategy(orm, cb) {
  // Refuse to run this migration strategy in production.
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_UNSAFE_MIGRATIONS) {
    return cb(new Error('`migrate: \'alter\'` strategy is not supported in production, please change to `migrate: \'safe\'`.'));
  }

  async.each(_.keys(orm.collections), function simultaneouslyMigrateEachModel(modelIdentity, next) {
    var WLModel = orm.collections[modelIdentity];

    // Grab the adapter to perform the query on
    var datastoreName = WLModel.datastore;
    var WLAdapter = orm.datastores[datastoreName].adapter;

    // Set a tableName to use
    var tableName = WLModel.tableName;

    // Build a dictionary to represent the underlying physical database structure.
    var tableDDLSpec = {};
    try {
      _.each(WLModel.schema, function parseAttribute(wlsAttrDef, wlsAttrName) {
        if (wlsAttrDef.collection) {
          return;
        }

        var columnName = wlsAttrDef.columnName;

        if (!_.has(wlsAttrDef, 'autoMigrations')) {
          throw new Error('An attribute in the model definition: `' + wlsAttrName + '` is missing an `autoMigrations` property. When running the `alter` migration, each attribute must have an autoMigrations key so that you don\'t end up with an invalid data schema.');
        }

        tableDDLSpec[columnName] = wlsAttrDef.autoMigrations;
      });
    } catch (e) {
      return next(e);
    }

    // Set Primary Key flag on the primary key attribute
    var primaryKeyAttrName = WLModel.primaryKey;
    var primaryKey = WLModel.schema[primaryKeyAttrName];
    if (primaryKey) {
      var pkColumnName = primaryKey.columnName;
      tableDDLSpec[pkColumnName].primaryKey = true;
    }

    // ---------------------------------------------------------------
    // Decide strategy based on whether the adapter supports describe()
    // ---------------------------------------------------------------

    if (_.isFunction(WLAdapter.describe)) {
      // Adapter has describe() — use incremental migration (e.g. MySQL)
      return migrateWithDescribe(WLAdapter, datastoreName, tableName, tableDDLSpec, WLModel, primaryKeyAttrName, next);
    }

    // Adapter lacks describe() (e.g. MongoDB) — just ensure indexes,
    // never drop the collection.
    return migrateWithoutDescribe(WLAdapter, datastoreName, tableName, tableDDLSpec, next);

  }, function afterMigrate(err) {
    if (err) {
      return cb(err);
    }

    return cb();
  });
};


/**
 * migrateWithoutDescribe()
 *
 * For schemaless adapters like MongoDB that don't implement describe().
 * Just call define() to ensure indexes exist. Never drop the collection.
 *
 * @param {Ref} WLAdapter
 * @param {String} datastoreName
 * @param {String} tableName
 * @param {Dictionary} tableDDLSpec
 * @param {Function} done
 */
function migrateWithoutDescribe(WLAdapter, datastoreName, tableName, tableDDLSpec, done) {
  WLAdapter.define(datastoreName, tableName, tableDDLSpec, function defineCallback(err) {
    if (err) {
      // Only warn for constraint-related failures (e.g. duplicate key for unique index).
      // Propagate real errors (connection, auth, etc.) as fatal.
      if (err.name === 'AdapterError') {
        console.warn('\n'+
          'Warning: When performing `alter` auto-migration on `' + tableName + '`,\n'+
          'the adapter could not apply all schema constraints (e.g. unique indexes).\n'+
          'This usually means existing data violates a new uniqueness constraint.\n'+
          'You may need to resolve duplicates manually.\n'+
          '\n'+
          'Error details:\n'+
          '```\n'+
          (err.message || util.inspect(err))+'\n'+
          '```\n'
        );
        return done();
      }
      return done(err);
    }

    return done();
  });
}


/**
 * migrateWithDescribe()
 *
 * For schema-aware adapters like MySQL that implement describe().
 * Checks current schema, and if the table exists with a compatible schema,
 * avoids dropping it. Falls back to drop+reinsert only when necessary.
 *
 * @param {Ref} WLAdapter
 * @param {String} datastoreName
 * @param {String} tableName
 * @param {Dictionary} tableDDLSpec
 * @param {Ref} WLModel
 * @param {String} primaryKeyAttrName
 * @param {Function} done
 */
function migrateWithDescribe(WLAdapter, datastoreName, tableName, tableDDLSpec, WLModel, primaryKeyAttrName, done) {

  WLAdapter.describe(datastoreName, tableName, function describeCallback(err, existingSchema) {
    if (err) {
      // Only treat "no such table" as recoverable. For that, adapters typically
      // return an AdapterError or an empty/null schema. Real errors (connection,
      // permissions) should propagate.
      if (err.name === 'AdapterError') {
        WLAdapter.define(datastoreName, tableName, tableDDLSpec, function(defineErr) {
          if (defineErr) { return done(defineErr); }
          return done();
        });
        return;
      }
      return done(err);
    }

    // If describe() returned nothing/empty, the table doesn't exist yet.
    if (!existingSchema || _.keys(existingSchema).length === 0) {
      WLAdapter.define(datastoreName, tableName, tableDDLSpec, function(err) {
        if (err) { return done(err); }
        return done();
      });
      return;
    }

    // Table exists. Check if schema changes are additive-only (safe).
    var newColumns = [];
    var warnings = [];

    _.each(tableDDLSpec, function(spec, columnName) {
      if (!existingSchema[columnName]) {
        newColumns.push(columnName);
      }
    });

    _.each(existingSchema, function(existingColDef, columnName) {
      if (!tableDDLSpec[columnName]) {
        warnings.push('Column `' + columnName + '` exists in the database but is no longer in the model. It will be left in place.');
      }
    });

    if (warnings.length > 0) {
      console.warn('\n'+
        'Auto-migration warnings for `' + tableName + '`:\n'+
        warnings.map(function(w) { return '  - ' + w; }).join('\n') + '\n'
      );
    }

    // If there are new columns, we need to rebuild the table because
    // the adapter interface doesn't expose ALTER TABLE directly.
    // Fall back to the safe drop+reinsert with JSON backup.
    if (newColumns.length > 0) {
      return fallbackDropAndReinsert(WLAdapter, datastoreName, tableName, tableDDLSpec, WLModel, primaryKeyAttrName, done);
    }

    // Schema is compatible (no new columns needed). Just ensure indexes
    // by calling define() — most adapters handle "IF NOT EXISTS" internally.
    WLAdapter.define(datastoreName, tableName, tableDDLSpec, function defineCallback(err) {
      if (err) {
        // define() failed on an existing table. Warn rather than triggering
        // a destructive fallback — dropping and reinserting would likely
        // hit the same error again (e.g. duplicate key for a new unique index).
        console.warn('\n'+
          'Warning: When performing `alter` auto-migration on `' + tableName + '`,\n'+
          'the adapter could not apply all schema constraints.\n'+
          'You may need to resolve this manually.\n'+
          '\n'+
          'Error details:\n'+
          '```\n'+
          (err.message || util.inspect(err))+'\n'+
          '```\n'
        );
      }

      return done();
    });
  });
}


/**
 * fallbackDropAndReinsert()
 *
 * The old-style drop+reinsert approach, but with a JSON backup written first.
 * Used only when non-destructive migration isn't possible (e.g. new columns
 * need to be added and the adapter doesn't support ALTER TABLE).
 *
 * @param {Ref} WLAdapter
 * @param {String} datastoreName
 * @param {String} tableName
 * @param {Dictionary} tableDDLSpec
 * @param {Ref} WLModel
 * @param {String} primaryKeyAttrName
 * @param {Function} done
 */
function fallbackDropAndReinsert(WLAdapter, datastoreName, tableName, tableDDLSpec, WLModel, primaryKeyAttrName, done) {

  var primaryKey = WLModel.schema[primaryKeyAttrName];
  var sort = primaryKey ? primaryKeyAttrName + ' ASC' : [];

  //  ╔═╗╔═╗╔╦╗  ┌┐ ┌─┐┌─┐┬┌─┬ ┬┌─┐  ┌┬┐┌─┐┌┬┐┌─┐
  //  ║ ╦║╣  ║   ├┴┐├─┤│  ├┴┐│ │├─┘   ││├─┤ │ ├─┤
  //  ╚═╝╚═╝ ╩   └─┘┴ ┴└─┘┴ ┴└─┘┴    ─┴┘┴ ┴ ┴ ┴ ┴
  WLModel.find()
  .meta({
    skipAllLifecycleCallbacks: true,
    skipRecordVerification: true,
    decrypt: true,
    skipExpandingDefaultSelectClause: true
  })
  .sort(sort)
  .exec(function findCallback(err, backupRecords) {
    if (err) {
      if (err.name === 'AdapterError') {
        backupRecords = [];
      } else {
        return done(flaverr({
          message: 'When attempting to perform the `alter` auto-migration strategy '+
          'on model `' + WLModel.identity + '`, Sails encountered an error.  '+err.message+'\n'+
          'Tip: Could there be existing records in the database that are not compatible '+
          'with a recent change to this model\'s definition?  If so, you might need to '+
          'migrate them manually or, if you don\'t care about the data, wipe them; e.g. --drop.\n'+
          '--\n'+
          'For help with auto-migrations, visit:\n'+
          ' [?] https://sailsjs.com/docs/concepts/models-and-orm/model-settings#?migrate\n'
        }, err));
      }
    }//>-•

    // Write a JSON backup BEFORE dropping. Abort if backup fails —
    // proceeding without a backup risks irreversible data loss.
    writeJsonBackup(WLModel.identity, backupRecords, function(backupErr) {
      if (backupErr) {
        return done(flaverr({
          message: 'When attempting to perform the `alter` auto-migration strategy '+
          'on model `' + WLModel.identity + '`, Sails could not write the JSON backup '+
          'required before the fallback drop-and-reinsert step. Aborting migration '+
          'before dropping data to avoid irreversible data loss.\n'+
          'Original error: ' + backupErr.message
        }, backupErr));
      }

      //  ╔╦╗╦═╗╔═╗╔═╗  ┌┬┐┌─┐┌┐ ┬  ┌─┐
      //   ║║╠╦╝║ ║╠═╝   │ ├─┤├┴┐│  ├┤
      //  ═╩╝╩╚═╚═╝╩     ┴ ┴ ┴└─┘┴─┘└─┘
      WLAdapter.drop(datastoreName, tableName, undefined, function dropCallback(err) {
        if (err) {
          informReFailedAlterStratagem(err, 'drop', WLModel.identity, backupRecords, done);//_∏_
          return;
        }//-•

        //  ╔╦╗╔═╗╔═╗╦╔╗╔╔═╗  ┌┬┐┌─┐┌┐ ┬  ┌─┐
        //   ║║║╣ ╠╣ ║║║║║╣    │ ├─┤├┴┐│  ├┤
        //  ═╩╝╚═╝╚  ╩╝╚╝╚═╝   ┴ ┴ ┴└─┘┴─┘└─┘
        WLAdapter.define(datastoreName, tableName, tableDDLSpec, function defineCallback(err) {
          if (err) {
            informReFailedAlterStratagem(err, 'define', WLModel.identity, backupRecords, done);//_∏_
            return;
          }//-•

          // If no backup records, we're done.
          if (backupRecords.length === 0) {
            return done();
          }

          //  ╦═╗╔═╗  ╦╔╗╔╔═╗╔═╗╦═╗╔╦╗  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐┌─┐
          //  ╠╦╝║╣───║║║║╚═╗║╣ ╠╦╝ ║   ├┬┘├┤ │  │ │├┬┘ ││└─┐
          //  ╩╚═╚═╝  ╩╝╚╝╚═╝╚═╝╩╚═ ╩   ┴└─└─┘└─┘└─┘┴└──┴┘└─┘

          // Sanitize backup records: strip keys not in the model,
          // so that removed attributes don't cause createEach to fail.
          var sanitizedRecords = sanitizeRecords(backupRecords, WLModel);

          WLModel.createEach(sanitizedRecords)
          .meta({
            skipAllLifecycleCallbacks: true
          })
          .exec(function createEachCallback(err) {
            if (err) {
              informReFailedAlterStratagem(err, 'createEach', WLModel.identity, backupRecords, done);//_∏_
              return;
            }//-•

            //  ╔═╗╔═╗╔╦╗  ┌─┐┌─┐┌─┐ ┬ ┬┌─┐┌┐┌┌─┐┌─┐
            //  ╚═╗║╣  ║   └─┐├┤ │─┼┐│ │├┤ ││││  ├┤
            //  ╚═╝╚═╝ ╩   └─┘└─┘└─┘└└─┘└─┘┘└┘└─┘└─┘
            if (WLModel.schema[primaryKeyAttrName].autoMigrations.autoIncrement !== true) {
              return done();
            }

            if (backupRecords.length === 0) {
              return done();
            }

            if (!_.has(WLAdapter, 'setSequence')) {
              console.warn('\n' +
                'Warning: Although `autoIncrement: true` was specified for the primary key\n' +
                'of this model (`' + WLModel.identity + '`), this adapter does not support the\n' +
                '`setSequence()` method, so the sequence number cannot be reset during the\n' +
                'auto-migration process.\n' +
                '(Proceeding without resetting the auto-increment sequence...)\n'
              );
              return done();
            }

            // Use attribute name to read from logical records returned by find().
            // Only fall back to columnName if the attribute name key isn't present.
            var lastRecord = _.last(backupRecords);
            var primaryKeyColumnName = WLModel.schema[primaryKeyAttrName].columnName;
            var sequenceName = WLModel.tableName + '_' + primaryKeyColumnName + '_seq';
            var sequenceValue = lastRecord[primaryKeyAttrName] !== undefined
              ? lastRecord[primaryKeyAttrName]
              : lastRecord[primaryKeyColumnName];

            WLAdapter.setSequence(datastoreName, sequenceName, sequenceValue, function setSequenceCb(err) {
              if (err) {
                return done(err);
              }

              return done();
            });//</ setSequence >
          });//</ createEach >
        });//</ define >
      });//</ drop >
    });//</ writeJsonBackup >
  });//</ find >
}


/**
 * sanitizeRecords()
 *
 * Strip keys from backup records that are not in the current model definition.
 * This prevents createEach from failing when columns have been removed.
 *
 * @param {Array} records
 * @param {Ref} WLModel
 * @returns {Array} sanitized records
 */
function sanitizeRecords(records, WLModel) {
  var validAttrNames = _.keys(WLModel.attributes);

  return _.map(records, function(record) {
    var sanitized = {};
    _.each(record, function(val, key) {
      if (_.contains(validAttrNames, key)) {
        sanitized[key] = val;
      }
    });
    return sanitized;
  });
}


/**
 * writeJsonBackup()
 *
 * Write a machine-readable JSON backup of records before a destructive migration.
 *
 * @param {String} modelIdentity
 * @param {Array} records
 * @param {Function} done
 */
function writeJsonBackup(modelIdentity, records, done) {
  if (records.length === 0) {
    return done();
  }

  // Don't write backups in the browser
  if (typeof window !== 'undefined') {
    return done();
  }

  var timeSeriesUniqueishSuffixPiece = Math.floor((Date.now()%10000000)/1000);
  var relPath = '.tmp/automigration-backup.' + modelIdentity + '.' + timeSeriesUniqueishSuffixPiece + '.json';
  var absPath = path.resolve(relPath);

  try {
    var fsx = require('fs-extra');
    var content = JSON.stringify(records, null, 2);
    fsx.outputFile(absPath, content, function(err) {
      if (err) {
        return done(err);
      }
      console.log('Auto-migration: wrote JSON backup of `' + modelIdentity + '` (' + records.length + ' records) to ' + relPath);
      return done();
    });
  } catch (e) {
    return done(e);
  }
}
