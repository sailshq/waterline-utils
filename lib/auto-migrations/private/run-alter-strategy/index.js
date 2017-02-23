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

var _ = require('@sailshq/lodash');
var async = require('async');
var informReFailedAlterStratagem = require('./private/inform-re-failed-alter-stratagem');


/**
 * runAlterStrategy()
 *
 * Drop each table in the database and rebuild it with the new model definition,
 * coercing and reinserting the existing table data (if possible).
 *
 * @param  {[type]}   orm [description]
 * @param  {Function} cb  [description]
 * @return {[type]}       [description]
 */
module.exports = function runAlterStrategy(orm, cb) {
  // Refuse to run this migration strategy in production.
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_UNSAFE_MIGRATIONS) {
    return cb(new Error('`migrate: \'alter\'` strategy is not supported in production, please change to `migrate: \'safe\'`.'));
  }

  // The alter strategy works by looping through each collection in the ORM and
  // pulling out the data that is currently in the database and keeping it in
  // memory. It then drops the table and rebuilds it based on the collection's
  // schema definition and the `autoMigrations` settings on the attributes.
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
        // If this is a plural association, then skip it.
        // (it is impossible for a key from this error to match up with one of these-- they don't even have column names)
        if (wlsAttrDef.collection) {
          return;
        }

        var columnName = wlsAttrDef.columnName;

        // If the attribute doesn't have an `autoMigrations` key on it, throw an error.
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


    //  ╔═╗╔═╗╔╦╗  ┌┐ ┌─┐┌─┐┬┌─┬ ┬┌─┐  ┌┬┐┌─┐┌┬┐┌─┐
    //  ║ ╦║╣  ║   ├┴┐├─┤│  ├┴┐│ │├─┘   ││├─┤ │ ├─┤
    //  ╚═╝╚═╝ ╩   └─┘┴ ┴└─┘┴ ┴└─┘┴    ─┴┘┴ ┴ ┴ ┴ ┴
    WLModel.find()
    .meta({
      skipAllLifecycleCallbacks: true,
      skipRecordVerification: true,
      skipExpandingDefaultSelectClause: true
    })
    .exec(function findCallback(err, backupRecords) {
      if (err) {
        // Ignore the error if it's an adapter error.  For example, this could error out
        // on an empty database when the table doesn't yet exist (which is perfectly fine).
        // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
        // FUTURE: further negotiate this error and only ignore failure due to "no such table"
        // (other errors are still relevant and important).  The database-specific piece of
        // this should happen in the adapter (and where supported, use a newly standardized
        // footprint from the underlying driver)
        // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
        if (err.name === 'AdapterError') {

          // Ignore.
          //
          // (But note that we also set backupRecords to an empty array so that it matches
          // what we'd expect if everything had worked out.)
          backupRecords = [];

        // But otherwise, this is NOT an adapter error, so still bail w/ a fatal error
        // (because this means something else completely unexpected has happened.)
        } else {
          return next(err);
        }
      }//>-•

      //  ╔╦╗╦═╗╔═╗╔═╗  ┌┬┐┌─┐┌┐ ┬  ┌─┐
      //   ║║╠╦╝║ ║╠═╝   │ ├─┤├┴┐│  ├┤
      //  ═╩╝╩╚═╚═╝╩     ┴ ┴ ┴└─┘┴─┘└─┘
      WLAdapter.drop(datastoreName, tableName, undefined, function dropCallback(err) {
        if (err) {
          informReFailedAlterStratagem(err, 'drop', WLModel.identity, backupRecords, next);//_∏_
          return;
        }//-•

        //  ╔╦╗╔═╗╔═╗╦╔╗╔╔═╗  ┌┬┐┌─┐┌┐ ┬  ┌─┐
        //   ║║║╣ ╠╣ ║║║║║╣    │ ├─┤├┴┐│  ├┤
        //  ═╩╝╚═╝╚  ╩╝╚╝╚═╝   ┴ ┴ ┴└─┘┴─┘└─┘
        WLAdapter.define(datastoreName, tableName, tableDDLSpec, function defineCallback(err) {
          if (err) {
            informReFailedAlterStratagem(err, 'define', WLModel.identity, backupRecords, next);//_∏_
            return;
          }//-•

          //  ╦═╗╔═╗  ╦╔╗╔╔═╗╔═╗╦═╗╔╦╗  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐┌─┐
          //  ╠╦╝║╣───║║║║╚═╗║╣ ╠╦╝ ║   ├┬┘├┤ │  │ │├┬┘ ││└─┐
          //  ╩╚═╚═╝  ╩╝╚╝╚═╝╚═╝╩╚═ ╩   ┴└─└─┘└─┘└─┘┴└──┴┘└─┘
          WLModel.createEach(backupRecords)
          .meta({
            skipAllLifecycleCallbacks: true
          })
          .exec(function createEachCallback(err) {
            if (err) {
              informReFailedAlterStratagem(err, 'createEach', WLModel.identity, backupRecords, next);//_∏_
              return;
            }//-•

            //  ╔═╗╔═╗╔╦╗  ┌─┐┌─┐┌─┐ ┬ ┬┌─┐┌┐┌┌─┐┌─┐
            //  ╚═╗║╣  ║   └─┐├┤ │─┼┐│ │├┤ ││││  ├┤
            //  ╚═╝╚═╝ ╩   └─┘└─┘└─┘└└─┘└─┘┘└┘└─┘└─┘
            // If this primary key attribute is not auto-incrementing, it won't have
            // a sequence attached.  So we can skip it.
            if (WLModel.schema[primaryKeyAttrName].autoMigrations.autoIncrement !== true) {
              return next();
            }

            // If there were no pre-existing records, we can also skip this step,
            // since the previous sequence number ought to be fine.
            if (backupRecords.length === 0) {
              return next();
            }

            // Otherwise, this model's primary key is auto-incrementing, so we'll expect
            // the adapter to have a setSequence method.
            if (!_.has(WLAdapter, 'setSequence')) {
              // If it doesn't, log a warning, then skip setting the sequence number.
              console.warn('\n' +
                'Warning: Although `autoIncrement: true` was specified for the primary key\n' +
                'of this model (`' + WLModel.identity + '`), this adapter does not support the\n' +
                '`setSequence()` method, so the sequence number cannot be reset during the\n' +
                'auto-migration process.\n' +
                '(Proceeding without resetting the auto-increment sequence...)\n'
              );
              return next();
            }


            // Now try to reset the sequence so that the next record created has a reasonable ID.
            var lastRecord = _.last(backupRecords);
            var primaryKeyColumnName = WLModel.schema[primaryKeyAttrName].columnName;
            var sequenceName = WLModel.tableName + '_' + primaryKeyColumnName + '_seq';
            var sequenceValue = lastRecord[primaryKeyColumnName];

            WLAdapter.setSequence(datastoreName, sequenceName, sequenceValue, function setSequenceCb(err) {
              if (err) {
                return next(err);
              }

              return next();
            });//</ setSequence >
          });//</ createEach >
        });//</ define >
      });//</ drop >
    });//</ find >
  }, function afterMigrate(err) {
    if (err) {
      return cb(err);
    }

    return cb();
  });
};
