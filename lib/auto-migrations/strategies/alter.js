//   █████╗ ██╗  ████████╗███████╗██████╗
//  ██╔══██╗██║  ╚══██╔══╝██╔════╝██╔══██╗
//  ███████║██║     ██║   █████╗  ██████╔╝
//  ██╔══██║██║     ██║   ██╔══╝  ██╔══██╗
//  ██║  ██║███████╗██║   ███████╗██║  ██║
//  ╚═╝  ╚═╝╚══════╝╚═╝   ╚══════╝╚═╝  ╚═╝
//
// Drops each table in the database and rebuilds it with the new model definition
// and the existing table data.


/**
 * Module dependencies
 */

var util = require('util');
var _ = require('@sailshq/lodash');
var async = require('async');


/**
 * [exports description]
 * @param  {[type]}   orm [description]
 * @param  {Function} cb  [description]
 * @return {[type]}       [description]
 */
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
          informReFailedAlterStratagem(err, 'createEach', WLModel.identity, backupRecords, next);//_∏_
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





/**
 * Module dependencies
 */

var util = require('util');
var flaverr = require('flaverr');

/**
 * informReFailedAlterStratagem()
 *
 * Write a log message to stderr about what went wrong with this auto-migration attempt,
 * then write a temporary log file with the backup records
 *
 * @param  {Error} err
 * @param  {String} operationName
 *     • 'drop'
 *     • 'define'
 *     • 'createEach'
 * @param  {String}   modelIdentity
 * @param  {Array}   backupRecords
 * @param  {Function}   done
 */
function informReFailedAlterStratagem(err, operationName, modelIdentity, backupRecords, done) {

  // Determine the path for the log file.
  // var friendlyDateTimeSlug = now.getMonth()+'-'+now.getDate()+'.'+now.getHours()+':'+now.getMinutes();
  var timeSeriesUniqueishSuffixPiece = Math.floor((Date.now()%10000000)/1000);
  var relPathToLogFile = '.tmp/failed-automigration.'+modelIdentity+'.'+timeSeriesUniqueishSuffixPiece+'.log';

  // TODO: Write backup records to disk.
  // ------
  // console.error('================================');
  // console.error('Data backup (`' + modelIdentity + '`):');
  // console.error('================================');
  // console.error('');
  // console.log(util.inspect(backupRecords, { depth: 5 }));
  // ------

  var message =
  'When attempting to perform the `alter` auto-migration strategy '+
  'on model `' + modelIdentity + '`, Sails encountered a problem';

  // Negotiate error in order to use an appropriate error message.
  var isFailureDueToFailedCoercion = (
    operationName === 'createEach' &&
    err.name === 'UsageError' &&
    err.code === 'E_INVALID_NEW_RECORDS'
  );
  if (isFailureDueToFailedCoercion) {

    message += '.  Some existing `' + modelIdentity + '` record(s) couldn\'t be adjusted automatically to match '+
    'your model definition.  Usually, this is a result of recent edits to your model files; or (less often) '+
    'due to incomplete inserts or modifications made directly to the database by hand.\n';
  }
  // Otherwise, this was some kind of weird, unexpected error.
  // So use the catch-all approach:
  else {
    message += ':\n'+util.inspect(err);
  }

  // Now for the suffix.
  message +=
  '\n'+
  '-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- \n'+
  'Development data could not be recovered automatically (see `'+ relPathToLogFile + '`).  '+
  'Any existing `'+ modelIdentity + '` records were lost, but your data from OTHER models '+
  '(including any relationships tracked in foreign keys and join tables) might still be intact.  '+
  'If you care about recovering any of that data, be sure to back it up now before you continue.\n'+
  // '(In the future, if you want to keep development data in order to practice manual migrations, '+
  // 'then set `migrate: \'safe\'` in config/models.js.)\n'+
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
  'After doing that once, you should be able to go about your business as usual.\n'+
  '-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- \n'+
  '\n'+
  'For questions, additional resources, or to chat with a human, visit:\n'+
  'https://sailsjs.com/support\n'+
  '\n';

  // Log the complete error message explaining what's up.
  console.error(message);

  // This timeout buys a bit of time to try to allow other queries which may
  // have already begun to complete (remember: we will probably be running this
  // from inside the iteratee of an `async.each`, where multiple failures
  // could occur in parallel.)
  setTimeout(function () {
    return done(flaverr('E_FAILED_ALTER_STRATEGEM', new Error('Automigrations failed.  (See logs above for details.)')));
  }, 1200);

}
