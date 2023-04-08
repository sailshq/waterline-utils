/**
 * Module dependencies
 */

var _ = require('@sailshq/lodash');
var runAlterStrategy = require('./private/run-alter-strategy');
var runDropStrategy = require('./private/run-drop-strategy');
var runSafeStrategy = require('./private/run-safe-strategy');


/**
 * runAutoMigrations()
 *
 * Auto-migrate all models in this orm using the given strategy.
 *
 * @param  {[type]}   strategy [description]
 * @param  {[type]}   orm      [description]
 * @param  {Function} cb       [description]
 * @return {[type]}            [description]
 */
module.exports = function runAutoMigrations(strategy, orm, cb) {

  // Ensure a callback function exists
  cb = cb || function (err, response) {
    if (err) { console.error(err); }
    return response;
  };

  //  ╦  ╦╔═╗╦  ╦╔╦╗╔═╗╔╦╗╔═╗  ┌─┐┌┬┐┬─┐┌─┐┌┬┐┌─┐┌─┐┬ ┬
  //  ╚╗╔╝╠═╣║  ║ ║║╠═╣ ║ ║╣   └─┐ │ ├┬┘├─┤ │ ├┤ │ ┬└┬┘
  //   ╚╝ ╩ ╩╩═╝╩═╩╝╩ ╩ ╩ ╚═╝  └─┘ ┴ ┴└─┴ ┴ ┴ └─┘└─┘ ┴
  if (!_.isString(strategy)) {
    return cb(new Error('Strategy must be one of: `alter`, `drop`, or `safe`.'));
  }

  //  ╦  ╦╔═╗╦  ╦╔╦╗╔═╗╔╦╗╔═╗  ┌─┐┬─┐┌┬┐
  //  ╚╗╔╝╠═╣║  ║ ║║╠═╣ ║ ║╣   │ │├┬┘│││
  //   ╚╝ ╩ ╩╩═╝╩═╩╝╩ ╩ ╩ ╚═╝  └─┘┴└─┴ ┴
  if (!orm || !_.isObject(orm)) {
    return cb(new Error('ORM must be an initialized Waterline ORM instance.'));
  }

  //  ╦═╗╦ ╦╔╗╔  ┌┬┐┬┌─┐┬─┐┌─┐┌┬┐┬┌─┐┌┐┌  ┌─┐┌┬┐┬─┐┌─┐┌┬┐┌─┐┌─┐┬ ┬
  //  ╠╦╝║ ║║║║  │││││ ┬├┬┘├─┤ │ ││ ││││  └─┐ │ ├┬┘├─┤ │ ├┤ │ ┬└┬┘
  //  ╩╚═╚═╝╝╚╝  ┴ ┴┴└─┘┴└─┴ ┴ ┴ ┴└─┘┘└┘  └─┘ ┴ ┴└─┴ ┴ ┴ └─┘└─┘ ┴
  switch(strategy){
    case 'alter': return runAlterStrategy(orm, cb);
    case 'drop': return runDropStrategy(orm, cb);
    case 'safe': return runSafeStrategy(orm, cb);
    default: return cb(new Error('Strategy must be one of: `alter`, `drop`, or `safe`.'));
  }
};
