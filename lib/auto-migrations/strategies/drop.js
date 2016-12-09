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
  async.each(_.keys(orm.collections), function migrateCollection(collectionName, next) {
    var WLModel = orm.collections[collectionName];

    // Grab the adapter to perform the query on
    var datastoreName = WLModel.adapterDictionary.update;
    var WLAdapter = orm.datastores[datastoreName].adapter;

    // Set a tableName to use
    var tableName = WLModel.tableName || WLModel.identity;

    // Build a schema to represent the underlying physical database structure
    var schema = {};
    _.each(WLModel.schema, function parseAttribute(attributeVal, attributeName) {
      var columnName = attributeVal.columnName || attributeName;

      // If the attribute doesn't have an `autoMigrations` key on it, ignore it.
      if (!_.has(attributeVal, 'autoMigrations')) {
        return;
      }

      schema[columnName] = attributeVal.autoMigrations;
    });

    // Set Primary Key flag on the primary key attribute
    var primaryKeyAttrName = WLModel.primaryKey;
    var primaryKey = WLModel.attributes[primaryKeyAttrName];
    if (primaryKey) {
      var pkColumnName = primaryKey.columnName || primaryKeyAttrName;
      schema[pkColumnName].primaryKey = true;
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
      WLAdapter.define(datastoreName, tableName, schema, function defineCallback(err) {
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
