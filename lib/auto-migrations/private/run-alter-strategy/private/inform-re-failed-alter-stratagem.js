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
 *         @param {Error?} err
 *                @property {String?} code  (E_FAILED_ALTER_STRATEGY)
 */
module.exports = function informReFailedAlterStratagem(err, operationName, modelIdentity, backupRecords, done) {

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
  'on model `' + modelIdentity + '`, Sails encountered ';

  // Negotiate error in order to use an appropriate error message.
  var isUniquenessViolation = (
    operationName === 'createEach' &&
    (err.name === 'AdapterError' && err.code === 'E_UNIQUE')
  );
  var isCoercionFailure = (
    operationName === 'createEach' &&
    (err.name === 'UsageError' && err.code === 'E_INVALID_NEW_RECORDS')
  );

  if (isCoercionFailure) {
    message += 'incompatible data.  '+
    'Some existing `' + modelIdentity + '` record(s) couldn\'t be adjusted automatically to match '+
    'your model definition.  Usually, this is a result of recent edits to your model files; or (less often) '+
    'due to incomplete inserts or modifications made directly to the database by hand.\n';
  }
  else if (isUniquenessViolation) {
    message += 'a conflict.  '+
    'Some existing `' + modelIdentity + '` record(s) violated a uniqueness constraint when attempting to '+
    'recreate them in the database (i.e. there were duplicates).  This is usually the result of recent edits '+
    'to your model files.  For example, someone might have changed a non-unique attribute to be `unique: true`, '+
    'modified a unique attribute\'s `columnName`, or changed the primary key attribute, etc.  Otherwise (more rarely), '+
    'this could be due to additional physical-layer indexes or constraints that were added directly to the '+
    'database by hand.\n';
  }
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // FUTURE: More error negotiation could be done here to further improve this message.
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // Otherwise this was some kind of weird, unexpected error.  So we use the catch-all approach:
  else {
    message += 'an unexpected error when performing the `'+operationName+'` step.  '+
    'This could have happened for a number of different reasons: be it because your database went offline, '+
    'because of a db permission issue, because of some database-specific edge case, or (more rarely) it '+
    'could even be due to some kind of bug in this adapter.\n';
  }

  // Now include the details about this error.
  message += '\n'+
  'Error details:\n'+
  '```\n'+
  util.inspect(err)+'\n';
  '```\n';

  // And last but not least, it's time for the suffix.
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

  // Now that we've fed our error message to make it big and strong, we can log the
  // completed error message to stderr so that the user understands what's up.
  console.error(message);

  // Finally, wait for a bit.
  // > This timeout buys a bit of time to try to allow other queries which may
  // > have already begun to complete (remember: we will probably be running this
  // > from inside the iteratee of an `async.each`, where multiple failures
  // > could occur in parallel.)
  setTimeout(function () {
    return done(flaverr('E_FAILED_ALTER_STRATEGEM', new Error('Automigrations failed.  (See logs above for details.)')));
  }, 1200);

};
