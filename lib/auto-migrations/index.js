//   █████╗ ██╗   ██╗████████╗ ██████╗
//  ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗
//  ███████║██║   ██║   ██║   ██║   ██║
//  ██╔══██║██║   ██║   ██║   ██║   ██║
//  ██║  ██║╚██████╔╝   ██║   ╚██████╔╝
//  ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝
//
//  ███╗   ███╗██╗ ██████╗ ██████╗  █████╗ ████████╗██╗ ██████╗ ███╗   ██╗███████╗
//  ████╗ ████║██║██╔════╝ ██╔══██╗██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║██╔════╝
//  ██╔████╔██║██║██║  ███╗██████╔╝███████║   ██║   ██║██║   ██║██╔██╗ ██║███████╗
//  ██║╚██╔╝██║██║██║   ██║██╔══██╗██╔══██║   ██║   ██║██║   ██║██║╚██╗██║╚════██║
//  ██║ ╚═╝ ██║██║╚██████╔╝██║  ██║██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║███████║
//  ╚═╝     ╚═╝╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝
//
// Given a set of models and a datastore, migrate the values based on a strategy.

var _ = require('@sailshq/lodash');
var strategies = require('./strategies');

module.exports = function runAutoMigrations(strategy, orm, cb) {
  //  ╦  ╦╔═╗╦  ╦╔╦╗╔═╗╔╦╗╔═╗  ┌─┐┌┬┐┬─┐┌─┐┌┬┐┌─┐┌─┐┬ ┬
  //  ╚╗╔╝╠═╣║  ║ ║║╠═╣ ║ ║╣   └─┐ │ ├┬┘├─┤ │ ├┤ │ ┬└┬┘
  //   ╚╝ ╩ ╩╩═╝╩═╩╝╩ ╩ ╩ ╚═╝  └─┘ ┴ ┴└─┴ ┴ ┴ └─┘└─┘ ┴
  if (!_.isString(strategy)) {
    return cb(new Error('Strategy must be one of: `alter`, `drop`, or `safe`.'));
  }

  if (_.indexOf(['alter', 'drop', 'safe'], strategy) < 0) {
    return cb(new Error('Strategy must be one of: `alter`, `drop`, or `safe`.'));
  }

  //  ╦  ╦╔═╗╦  ╦╔╦╗╔═╗╔╦╗╔═╗  ┌─┐┬─┐┌┬┐
  //  ╚╗╔╝╠═╣║  ║ ║║╠═╣ ║ ║╣   │ │├┬┘│││
  //   ╚╝ ╩ ╩╩═╝╩═╩╝╩ ╩ ╩ ╚═╝  └─┘┴└─┴ ┴
  if (!orm || !_.isPlainObject(orm)) {
    return cb(new Error('ORM must be an initialized Waterline ORM instance.'));
  }

  // Ensure a callback function exists
  if (!cb || !_.isFunction(cb)) {
    throw new Error('Missing callback argument.');
  }

  //  ╦═╗╦ ╦╔╗╔  ┌┬┐┬┌─┐┬─┐┌─┐┌┬┐┬┌─┐┌┐┌  ┌─┐┌┬┐┬─┐┌─┐┌┬┐┌─┐┌─┐┬ ┬
  //  ╠╦╝║ ║║║║  │││││ ┬├┬┘├─┤ │ ││ ││││  └─┐ │ ├┬┘├─┤ │ ├┤ │ ┬└┬┘
  //  ╩╚═╚═╝╝╚╝  ┴ ┴┴└─┘┴└─┴ ┴ ┴ ┴└─┘┘└┘  └─┘ ┴ ┴└─┴ ┴ ┴ └─┘└─┘ ┴
  strategies[strategy](orm, cb);
};
