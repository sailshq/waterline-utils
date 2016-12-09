//   █████╗ ██╗  ████████╗███████╗██████╗
//  ██╔══██╗██║  ╚══██╔══╝██╔════╝██╔══██╗
//  ███████║██║     ██║   █████╗  ██████╔╝
//  ██╔══██║██║     ██║   ██╔══╝  ██╔══██╗
//  ██║  ██║███████╗██║   ███████╗██║  ██║
//  ╚═╝  ╚═╝╚══════╝╚═╝   ╚══════╝╚═╝  ╚═╝
//
// Drops each table in the database and rebuilds it with the new model definition
// and the existing table data.

var _ = require('@sailshq/lodash');
var async = require('async');

module.exports = function alterStrategy(orm, cb) {
  // Refuse to run this migration strategy in production.
  if (process.env.NODE_ENV === 'production') {
    return cb(new Error('`migrate: "alter"` strategy is not supported in production, please change to `migrate: "safe"`.'));
  }

  // The alter strategy works by looping through each collection in the ORM and
  // pulling out the data that is currently in the database and keeping it in
  // memory. It then drops the table and rebuilds it based on the collection's
  // schema definition and the `autoMigrations` settings on the attributes.
  async.each(_.keys(orm.collections), function migrateCollection(collectionName, next) {
    var WLModel = orm.collections[collectionName];

    // Grab the adapter to perform the query on
    var datastoreName = WLModel.adapterDictionary.update;
    var WLAdapter = orm.datastores[datastoreName].adapter;

    // Set a tableName to use
    var tableName = WLModel.tableName || WLModel.identity;

    // Build a query to execute against the adapter.
    var query = {
      using: tableName,
      criteria: {}
    };

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

    //  ╔═╗╔═╗╔╦╗  ┌┐ ┌─┐┌─┐┬┌─┬ ┬┌─┐  ┌┬┐┌─┐┌┬┐┌─┐
    //  ║ ╦║╣  ║   ├┴┐├─┤│  ├┴┐│ │├─┘   ││├─┤ │ ├─┤
    //  ╚═╝╚═╝ ╩   └─┘┴ ┴└─┘┴ ┴└─┘┴    ─┴┘┴ ┴ ┴ ┴ ┴
    WLAdapter.find(datastoreName, query, function findCallback(err, backupRecords) {
      if (err) {
        // Ignore the error for now. This could error out on an empty database.
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

          // Check if there are backup records to insert
          if (!backupRecords || !backupRecords.length) {
            return next();
          }

          //  ╦═╗╔═╗  ╦╔╗╔╔═╗╔═╗╦═╗╔╦╗  ┬─┐┌─┐┌─┐┌─┐┬─┐┌┬┐┌─┐
          //  ╠╦╝║╣───║║║║╚═╗║╣ ╠╦╝ ║   ├┬┘├┤ │  │ │├┬┘ ││└─┐
          //  ╩╚═╚═╝  ╩╝╚╝╚═╝╚═╝╩╚═ ╩   ┴└─└─┘└─┘└─┘┴└──┴┘└─┘
          var insertQuery = {
            using: tableName,
            newRecords: backupRecords
          };

          // Build up a meta key to pass additional options to the driver
          var meta = {
            dontIncrementSequencesOnCreateEach: true
          };

          WLAdapter.createEach(datastoreName, insertQuery, function createEachCallback(err) {
            if (err) {
              return next(err);
            }

            // All the records were written successfully.
            return next();
          }, meta);
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
