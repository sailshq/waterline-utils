//   █████╗ ██╗  ████████╗███████╗██████╗
//  ██╔══██╗██║  ╚══██╔══╝██╔════╝██╔══██╗
//  ███████║██║     ██║   █████╗  ██████╔╝
//  ██╔══██║██║     ██║   ██╔══╝  ██╔══██╗
//  ██║  ██║███████╗██║   ███████╗██║  ██║
//  ╚═╝  ╚═╝╚══════╝╚═╝   ╚══════╝╚═╝  ╚═╝
//
// Drops each table in the database and rebuilds it with the new model definition
// and the existing table data.

var util = require('util');
var _ = require('@sailshq/lodash');
var async = require('async');

module.exports = function alterStrategy(orm, cb) {
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
    _.each(WLModel.schema, function parseAttribute(wlsAttrDef) {
      // If this is a plural association, then skip it.
      // (it is impossible for a key from this error to match up with one of these-- they don't even have column names)
      if (wlsAttrDef.collection) {
        return;
      }

      var columnName = wlsAttrDef.columnName;

      // If the attribute doesn't have an `autoMigrations` key on it, ignore it.
      if (!_.has(wlsAttrDef, 'autoMigrations')) {
        return;
      }

      tableDDLSpec[columnName] = wlsAttrDef.autoMigrations;
    });

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
        if (err.name === 'AdapterError') {
          // Ignore.
          //
          // (But note that we also set backupRecords to an empty array so that it matches
          // what we'd expect if everything had worked out.)
          backupRecords = [];
          // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
          // FUTURE: negotiate this error and only ignore failure due to "no such table"
          // (other errors are still relevant and important).  The database-specific piece of this should happen in the adapter (and where supported, use a newly standardized footprint from the underlying driver)
          // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

        // But otherwise, this is NOT an adapter error, so still bail w/ a fatal error
        // (because this means something else completely unexpected has happened.)
        } else {
          return next(err);
        }
      }

      //  ╔╦╗╦═╗╔═╗╔═╗  ┌┬┐┌─┐┌┐ ┬  ┌─┐
      //   ║║╠╦╝║ ║╠═╝   │ ├─┤├┴┐│  ├┤
      //  ═╩╝╩╚═╚═╝╩     ┴ ┴ ┴└─┘┴─┘└─┘
      WLAdapter.drop(datastoreName, tableName, undefined, function dropCallback(err) {
        if (err) {
          return next(err);
        }

        //  ╔╦╗╔═╗╔═╗╦╔╗╔╔═╗  ┌┬┐┌─┐┌┐ ┬  ┌─┐
        //   ║║║╣ ╠╣ ║║║║║╣    │ ├─┤├┴┐│  ├┤
        //  ═╩╝╚═╝╚  ╩╝╚╝╚═╝   ┴ ┴ ┴└─┘┴─┘└─┘
        WLAdapter.define(datastoreName, tableName, tableDDLSpec, function defineCallback(err) {
          if (err) {
            // Ugh oh, something happened and all hope is lost. Print the data
            // out so the user has it.
            console.error('When attempting to perform the `alter` auto-migration strategy on model `' + WLModel.identity + '`, Sails encountered an error.  This is usually because some existing records couldn\'t be adjusted automatically to match the new model definition.');
            console.error();
            console.error('If you re-lift your app, you should be able to proceed... but note that all existing records in this model will be gone!  So, in a couple of seconds, these records will be logged to stdout, just in case you need them.  (Keep in mind this is just a last resort, put in place to preserve some of your development data, if possible.)');
            console.error('In the mean time, here\'s the error that occurred:');
            console.error();
            console.error(err);
            console.error();

            setTimeout(function printSomeData() {
              console.error('================================');
              console.error('Data backup (`' + WLModel.identity + '`):');
              console.error('================================');
              console.error('');
              console.log(util.inspect(backupRecords, { depth: 5 }));

              return next(err);
            }, 1200);

            // Return to prevent callback being called multiple times
            return;
          }

          //  ╦═╗╔═╗  ╦╔╗╔╔═╗╔═╗╦═╗╔╦╗  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐┌─┐
          //  ╠╦╝║╣───║║║║╚═╗║╣ ╠╦╝ ║   ├┬┘├┤ │  │ │├┬┘ ││└─┐
          //  ╩╚═╚═╝  ╩╝╚╝╚═╝╚═╝╩╚═ ╩   ┴└─└─┘└─┘└─┘┴└──┴┘└─┘
          WLModel.createEach(backupRecords)
          .meta({
            skipAllLifecycleCallbacks: true
          })
          .exec(function createEachCallback(err) {
            if (err) {
              // Ugh oh, something happened and all hope is lost. Print the data
              // out so the user has it.
              console.error(
                'When attempting to perform the `alter` auto-migration strategy on model `' + WLModel.identity + '`, Sails encountered an error.  This is usually because some existing records couldn\'t be adjusted automatically to match the new model definition.\n'+
                '\n'+
                'If you re-lift your app, you should be able to proceed... but note that all existing records in this model will be gone!  So, in a couple of seconds, these records will be logged to stdout, just in case you need them.  (Keep in mind this is just a last resort, put in place to preserve some of your development data, if possible.)\n'+
                'In the mean time, here\'s the error that occurred:\n'+
                '\n'+
                util.inspect(err)+'\n'+
                '\n'
              );

              // This timeout buys a bit of time to try to allow other queries which may
              // have already begun to complete (remember: we're inside the iteratee subcircuit
              // of an `async.each`, not an `eachSeries`.)
              setTimeout(function printSomeData() {
                console.error('================================');
                console.error('Data backup (`' + WLModel.identity + '`):');
                console.error('================================');
                console.error('');
                console.log(util.inspect(backupRecords, { depth: 5 }));

                return next(err);
              }, 1200);//_∏_

              // Return to prevent inadverently running the other logic below which
              // (among other potentially-more-sinister things) would result in the
              // triggering another outlet below (i.e. invoking `next` multiple times).
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
            });
          });
        });
      });
    });
  }, function afterMigrate(err) {
    if (err) {
      return cb(err);
    }

    return cb();
  });
};



/**
 * [informReFailedAlterStratagem description]
 * @param  {[type]}   failureReport
 *         @property {Ref} error
 *         @property {String} operationName
 *           • 'drop'
 *           • 'define'
 *           • 'createEach'
 * @param  {[type]}   modelIdentity [description]
 * @param  {[type]}   backupRecords [description]
 * @param  {Function} done          [description]
 * @return {[type]}                 [description]
 */
function informReFailedAlterStratagem(failureReport, modelIdentity, backupRecords, done) {

  var message =
  'When attempting to perform the `alter` auto-migration strategy '+
  'on model `' + modelIdentity + '`, Sails encountered a problem';

  var err = failureReport.error;


  message += (function(){

    switch (failureReport.operationName) {
      case 'createEach': (function(){
        switch (err.name) {
          case 'UsageError': (function(){
            switch (err.code) {
              case 'E_INVALID_NEW_RECORDS': return '.  Some existing `' + modelIdentity + '` record(s) couldn\'t be adjusted automatically to match your model definition.  Usually, this is a result of recent edits to your model files; or (less often) due to incomplete inserts or modifications made directly to the database by hand.';
            }
          })(); break;
          case 'AdapterError': (function(){
            switch (err.code) {
              case 'E_UNIQUE': return 'TODO';
            }
          })(); break;
        }
      })(); break;

      default: break;
    }

    // Catch-all:
    return ':\n'+util.inspect(err);

  })()+'\n'+
  '\n'+
  '-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- \n'+
  'Development data could not be recovered automatically (see `.tmp/failed-automigration.log`).  '+
  'Any existing `'+ modelIdentity + '` records were lost, but your data from OTHER models '+
  '(including any relationships tracked in foreign keys and join tables) might still be intact.  '+
  'If you care about recovering any of that data, be sure to back it up now before you continue.\n'+
  '\n'+
  'The best way to proceed from here is to clear out all of your old development data '+
  'and start fresh; allowing Sails to generate new tables/collections(s) to reflect your '+
  'app\'s models.  (In other words, to DELETE ALL EXISTING DATA stored in models.)\n'+
  '\n'+
  'To do that, re-lift your app using the `drop` strategy:\n'+
  '```\n'+
  'sails lift --models.migrate=drop\n'+
  '```\n'+
  '\n'+
  'After doing that once, you should be go about your business as usual.\n'+
  '\n';


  // Log error message explaining what's up.
  console.error(message);

  // // 'By the way, for your convenience, Sails backed up your `'+ modelIdentity + '` records before attempting to auto-migrate them.  , so in a couple of seconds, they will be logged to stdout, just in case you need them.  (Keep in mind this is just a last resort, put in place to preserve some of your development data, if possible.)\n'+
  // '\n'+
  // 'Your data from other models (including any relationships tracked in foreign keys and join tables) might still be intact.  If you care about recovering any of that data, be sure to back it up now before you continue.\n'+
  // '\n'+
  // // 'By the way, for your convenience, Sails backed up the records from your `'+ modelIdentity + '` '+
  // // 'model before attempting to auto-migrate.  In a couple of seconds, these backup records will '+
  // // 'be written to `.tmp/failed-automigration.json`, in case you need them.'
  // '\n'

  // This timeout buys a bit of time to try to allow other queries which may
  // have already begun to complete (remember: we're inside the iteratee subcircuit
  // of an `async.each`, not an `eachSeries`.)
  setTimeout(function printSomeData() {
    console.error('================================');
    console.error('Data backup (`' + modelIdentity + '`):');
    console.error('================================');
    console.error('');
    console.log(util.inspect(backupRecords, { depth: 5 }));

    return next(err);
  }, 1200);//_∏_

  // Return to prevent inadverently running the other logic below which
  // (among other potentially-more-sinister things) would result in the
  // triggering another outlet below (i.e. invoking `next` multiple times).
  return;

}
