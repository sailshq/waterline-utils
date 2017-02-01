//  ██████╗ ██████╗  ██████╗ ██████╗
//  ██╔══██╗██╔══██╗██╔═══██╗██╔══██╗
//  ██║  ██║██████╔╝██║   ██║██████╔╝
//  ██║  ██║██╔══██╗██║   ██║██╔═══╝
//  ██████╔╝██║  ██║╚██████╔╝██║
//  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝
//
// Drops each table in the database and rebuilds it with the new model definition/

var _ = require('@sailshq/lodash');
var async = require('async');

module.exports = function dropStrategy(orm, cb) {
  // Refuse to run this migration strategy in production.
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_UNSAFE_MIGRATIONS) {
    return cb(new Error('`migrate: \'drop\'` strategy is not supported in production, please change to `migrate: \'safe\'`.'));
  }

  async.each(_.keys(orm.collections), function simultaneouslyMigrateEachModel(modelIdentity, next) {
    var WLModel = orm.collections[modelIdentity];

    // Grab the adapter to perform the query on
    var datastoreName = WLModel.datastore;
    var WLAdapter = orm.datastores[datastoreName].adapter;

    // Set a tableName to use
    var tableName = WLModel.tableName || WLModel.identity;
    // ^^TODO: get rid of this short-circuit (hopefully)
    // (shouldn't it always have a normalized tableName at this point?)

    // Build a dictionary to represent the underlying physical database structure
    var tableDDLSpec = {};
    _.each(WLModel.schema, function parseAttribute(wlsAttrDef, attributeName) {

      // TODO: skip plural associations
      // (basically === to what we have here: https://github.com/balderdashy/waterline/blob/88f38ab740fdf6f40b905673319cb0d630b94ffc/lib/waterline/utils/query/forge-adapter-error.js#L200-L208)

      // TODO: get rid of this short-circuit (it should always have a column name
      // at this point thx to wl-schema)
      var columnName = wlsAttrDef.columnName || attributeName;

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
          return next(err);
        }

        return next();
      });
    });
  }, function afterMigrate(err) {
    if (err) {
      return cb(err);
    }

    return cb();
  });
};
