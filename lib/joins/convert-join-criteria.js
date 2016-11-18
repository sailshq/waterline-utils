//   ██████╗ ██████╗ ███╗   ██╗██╗   ██╗███████╗██████╗ ████████╗         ██╗ ██████╗ ██╗███╗   ██╗
//  ██╔════╝██╔═══██╗████╗  ██║██║   ██║██╔════╝██╔══██╗╚══██╔══╝         ██║██╔═══██╗██║████╗  ██║
//  ██║     ██║   ██║██╔██╗ ██║██║   ██║█████╗  ██████╔╝   ██║            ██║██║   ██║██║██╔██╗ ██║
//  ██║     ██║   ██║██║╚██╗██║╚██╗ ██╔╝██╔══╝  ██╔══██╗   ██║       ██   ██║██║   ██║██║██║╚██╗██║
//  ╚██████╗╚██████╔╝██║ ╚████║ ╚████╔╝ ███████╗██║  ██║   ██║       ╚█████╔╝╚██████╔╝██║██║ ╚████║
//   ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝   ╚═╝        ╚════╝  ╚═════╝ ╚═╝╚═╝  ╚═══╝
//
//   ██████╗██████╗ ██╗████████╗███████╗██████╗ ██╗ █████╗
//  ██╔════╝██╔══██╗██║╚══██╔══╝██╔════╝██╔══██╗██║██╔══██╗
//  ██║     ██████╔╝██║   ██║   █████╗  ██████╔╝██║███████║
//  ██║     ██╔══██╗██║   ██║   ██╔══╝  ██╔══██╗██║██╔══██║
//  ╚██████╗██║  ██║██║   ██║   ███████╗██║  ██║██║██║  ██║
//   ╚═════╝╚═╝  ╚═╝╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝
//
// Given some Waterline criteria, inspect it for any joins and determine how
// to go about building up queries. If the joins don't contain any criteria
// or any skip, sort, or limit clauses then a single query can be built.
// Otherwise the first query will need to be run and then using the primary
// key of the "parent" build up a child query. This child query will be either
// an IN query using a map of the parent's primary key or a big UNION query.
// The UNION query is used in situations where you are basically filtering
// the child results. It's a rare case and will result in a non-ideal query
// but is supported in the Waterline API.
//
// EX: In the following case the UNION query will run the query specific to
// each user that is found.`
//
// Model.find()
// .populate('pets', { type: 'cat', sort: 'name', limit: 5 })
// .exec()
//

var _ = require('lodash');
var Helpers = require('./private');
var Converter = require('../query/converter');

module.exports = function convertCriteria(options) {
  //  ╦  ╦╔═╗╦  ╦╔╦╗╔═╗╔╦╗╔═╗  ┌─┐┌─┐┌┬┐┬┌─┐┌┐┌┌─┐
  //  ╚╗╔╝╠═╣║  ║ ║║╠═╣ ║ ║╣   │ │├─┘ │ ││ ││││└─┐
  //   ╚╝ ╩ ╩╩═╝╩═╩╝╩ ╩ ╩ ╚═╝  └─┘┴   ┴ ┴└─┘┘└┘└─┘
  if (_.isUndefined(options) || !_.isPlainObject(options)) {
    throw new Error('Invalid options argument. Options must contain: tableName, schemaName, getPk, and criteria.');
  }

  if (!_.has(options, 'tableName') || !_.isString(options.tableName)) {
    throw new Error('Invalid option used in options argument. Missing or invalid tableName.');
  }

  if (!_.has(options, 'schemaName') || !_.isString(options.schemaName)) {
    throw new Error('Invalid option used in options argument. Missing or invalid schemaName.');
  }

  if (!_.has(options, 'getPk') || !_.isFunction(options.getPk)) {
    throw new Error('Invalid option used in options argument. Missing or invalid getPk function.');
  }

  if (!_.has(options, 'criteria') || !_.isPlainObject(options.criteria)) {
    throw new Error('Invalid option used in options argument. Missing or invalid criteria.');
  }

  // Store the validated options for use
  var criteria = options.criteria;
  var tableName = options.tableName;
  var schemaName = options.schemaName;
  var getPk = options.getPk;


  // Add a statement var that will be used to build up a Waterline Statement
  // from the criteria.
  var parentStatement;
  var childStatements = [];

  // Add a flag to determine if this query will need to be a slow join or not.
  var slowJoin = false;


  //  ╔╗╔╔═╗   ┬┌─┐┬┌┐┌┌─┐
  //  ║║║║ ║   ││ │││││└─┐
  //  ╝╚╝╚═╝  └┘└─┘┴┘└┘└─┘
  // If the criteria has no join instructions go ahead and build a very simple
  // statement then bail out. Nothing fancy to do here.
  if (!_.has(criteria, 'joins')) {
    try {
      parentStatement = Converter({
        model: tableName,
        method: 'find',
        criteria: criteria,
        opts: {
          schema: schemaName
        }
      });
    } catch (e) {
      throw new Error('There was an error converting the Waterline Query into a Waterline Statement: ' + e.message);
    }

    return {
      parentStatement: parentStatement
    };
  }


  //  ╔═╗╦  ╔═╗╔╗╔  ┌─┐ ┬ ┬┌─┐┬─┐┬ ┬
  //  ╠═╝║  ╠═╣║║║  │─┼┐│ │├┤ ├┬┘└┬┘
  //  ╩  ╩═╝╩ ╩╝╚╝  └─┘└└─┘└─┘┴└─ ┴
  // If there ARE joins, replace the criteria with the planned instructions. These
  // are instructions that have been expanded to include the normalized join
  // strategy.
  criteria = Helpers.planner({
    criteria: criteria,
    getPk: getPk
  });


  //  ╔═╗╦ ╦╔═╗╔═╗╦╔═  ┌─┐┌─┐┬─┐  ┌─┐┬  ┌─┐┬ ┬   ┬┌─┐┬┌┐┌
  //  ║  ╠═╣║╣ ║  ╠╩╗  ├┤ │ │├┬┘  └─┐│  │ ││││   ││ │││││
  //  ╚═╝╩ ╩╚═╝╚═╝╩ ╩  └  └─┘┴└─  └─┘┴─┘└─┘└┴┘  └┘└─┘┴┘└┘
  // Go through and check if any of the join instructions are
  // using any sort of criteria. If not, build up a single statement.
  //
  // When criteria is used on a join (populate) it complicates things. Based on
  // the way populates work in Waterline, criteria on the population is used
  // as a filter on the children and not the parents. Because of this the criteria
  // can't simply be added into the query. This is called a slow join because it
  // can't be fulfilled in a single query, it must be run in two queries. The
  // first query finds all the matching parent records and the second query finds
  // the records being populated along with the given criteria.

  // Hold an array of population aliases that can't be run in a single query
  var slowJoinAliases = [];

  // Hold a map of joins that will be needed. If two joins need the same data
  // but are connected in different ways then there will be some slow joins
  // needed. This is used when you have a model that has multiple collection
  // attributes pointing to the same model but using different `via` attributes.
  // See below for more information.
  var joinMaps = {};

  _.each(criteria.instructions, function processJoins(val, key) {
    // Process each instruction for the aliases being populated
    _.each(val.instructions, function checkForCriteria(joinSet) {
      // Check if the tables in this have already been joined in some way. If
      // so, then a slow join is needed to fufill any further requests. This is
      // commonly used when a parent is populating multiple attributes from the
      // same table. See the multiple foreign keys test from Waterline-Adapter-Tests.
      if (_.has(joinMaps, joinSet.child) && joinMaps[joinSet.child] !== joinSet.childKey) {
        slowJoin = true;
        slowJoinAliases.push(key);
        return;
      }

      // Add this join to the mapping
      joinMaps[joinSet.child] = joinSet.childKey;

      // If there isn't any criteria set there is no need to make this a slowJoin
      if (!_.has(joinSet, 'criteria')) {
        return;
      }

      // If there is an empty criteria object set, no need to make this a slowJoin
      if (_.keys(joinSet.criteria).length === 0) {
        return;
      }

      // Well looks like some criteria is mixed up in here. In this case
      // there will need to be multiple queries. Set a flag so we can process
      // them individually.
      slowJoin = true;
      slowJoinAliases.push(key);
    });
  });


  //  ╔╗ ╦ ╦╦╦  ╔╦╗   ┬┌─┐┬┌┐┌  ┌─┐┌┬┐┌─┐┌┬┐┌─┐┌┬┐┌─┐┌┐┌┌┬┐
  //  ╠╩╗║ ║║║   ║║   ││ │││││  └─┐ │ ├─┤ │ ├┤ │││├┤ │││ │
  //  ╚═╝╚═╝╩╩═╝═╩╝  └┘└─┘┴┘└┘  └─┘ ┴ ┴ ┴ ┴ └─┘┴ ┴└─┘┘└┘ ┴
  // If there wasn't a slow join found go ahead and try and build a statement.
  // This is a query that can be executed in a single run. These will be the
  // fastest and take the least amount of time to run.
  if (!slowJoin) {
    // Try and convert the criteria into a Waterline Statement
    try {
      parentStatement = Converter({
        model: tableName,
        method: 'find',
        criteria: criteria,
        opts: {
          schema: schemaName
        }
      });
    } catch (e) {
      throw new Error('There was an error converting the Waterline Query into a Waterline Statement: ' + e.message);
    }

    // After check if this is a type 3 join. The VIA_JUNCTOR queries need a way
    // to link parent and child records together without holding all the additional
    // join table records in memory. To do this we add a special SELECT statement
    // to the criteria instructions. This allows the child records to appear
    // as if they were simple hasMany records.
    _.each(criteria.instructions, function checkStrategy(val) {
      if (val.strategy.strategy !== 3) {
        return;
      }

      // Otherwise modify the SELECT and add a special key
      var junctor = _.first(val.instructions);
      var child = _.last(val.instructions);

      // The "special" key is simply a reserved word `__parent_fk` that can easily
      // be parsed out of the results. It contains the value that was found in
      // the join table that links it to the parent.
      var selectStr = junctor.child + '.' + junctor.childKey + ' as ' + child.alias + '___parent_fk';
      parentStatement.select.push(selectStr);
    });

    // Expand the criteria so it doesn't contain any ambiguous fields
    try {
      parentStatement.where = Helpers.expandCriteria(parentStatement.where, tableName);
    } catch (e) {
      throw new Error('There was an error trying to expand the criteria used in the WHERE clause. Perhaps it is invalid? ' + e.stack);
    }

    return {
      parentStatement: parentStatement
    };
  }


  //  ╔╗ ╦ ╦╦╦  ╔╦╗  ┌─┐┬  ┌─┐┬ ┬  ┌─┐┌─┐┬─┐┌─┐┌┐┌┌┬┐  ┌─┐ ┬ ┬┌─┐┬─┐┬ ┬
  //  ╠╩╗║ ║║║   ║║  └─┐│  │ ││││  ├─┘├─┤├┬┘├┤ │││ │   │─┼┐│ │├┤ ├┬┘└┬┘
  //  ╚═╝╚═╝╩╩═╝═╩╝  └─┘┴─┘└─┘└┴┘  ┴  ┴ ┴┴└─└─┘┘└┘ ┴   └─┘└└─┘└─┘┴└─ ┴
  // Otherwise build up a statement for the "parent" query. This is just a
  // statement with all the join instructions stripped out from it.
  //
  // It's responsibility is to get the parent's primary keys that can be used
  // in another query to fufill the request. These are much slower.
  try {
    var modifiedCriteria = _.merge({}, criteria);

    // Remove any slow joins from the criteria so they will be processed separately.
    _.each(slowJoinAliases, function cleanseCriteria(alias) {
      delete modifiedCriteria.instructions[alias];
    });

    parentStatement = Converter({
      model: tableName,
      method: 'find',
      criteria: modifiedCriteria,
      opts: {
        schema: schemaName
      }
    });
  } catch (e) {
    throw new Error('There was an error converting the Waterline Query into a Waterline Statement. ' + e.stack);
  }

  // Expand the criteria so it doesn't contain any ambiguous fields
  try {
    parentStatement.where = Helpers.expandCriteria(parentStatement.where, tableName);
  } catch (e) {
    throw new Error('There was an error trying to expand the criteria used in the WHERE clause. Perhaps it is invalid? ' + e.stack);
  }


  //  ╔╗ ╦ ╦╦╦  ╔╦╗  ┌─┐┬  ┌─┐┬ ┬  ┌─┐┬ ┬┬┬  ┌┬┐  ┌─┐ ┬ ┬┌─┐┬─┐┬ ┬
  //  ╠╩╗║ ║║║   ║║  └─┐│  │ ││││  │  ├─┤││   ││  │─┼┐│ │├┤ ├┬┘└┬┘
  //  ╚═╝╚═╝╩╩═╝═╩╝  └─┘┴─┘└─┘└┴┘  └─┘┴ ┴┴┴─┘─┴┘  └─┘└└─┘└─┘┴└─ ┴
  //  ┌┬┐┌─┐┌┬┐┌─┐┬  ┌─┐┌┬┐┌─┐
  //   │ ├┤ │││├─┘│  ├─┤ │ ├┤
  //   ┴ └─┘┴ ┴┴  ┴─┘┴ ┴ ┴ └─┘
  // This is a template that will be used for the children queries. It will be
  // formed based upon the type of query being run and the strategy used.
  //
  // The template is simply a placeholder that represents what query will be need
  // to be run to find the child. It contains a placeholder value that can't be
  // generated until the parent query has finished.
  //
  // Once a parent query has been run the child template can be rendered and then
  // run through as a native query to get the remaining results.
  _.each(slowJoinAliases, function buildJoinTemplate(alias) {
    // Grab the join instructions
    var instructions = criteria.instructions[alias];

    // Grab the strategy type off the instructions
    var strategy = instructions.strategy.strategy;

    // Hold the generated statement template
    var statement;

    // Hold the primary key attribute to use for the template
    var primaryKeyAttr;

    // Hold an empty template for the where criteria that will be built as a
    // stand in. This will be editied to contain the primary keys of the parent
    // query results.
    var whereTemplate = {};

    // Grab the parent instructions
    var parentInstructions = _.first(instructions.instructions);

    // Check if the parent is paginated
    var paginated = _.has(parentInstructions.criteria, 'skip') || _.has(parentInstructions.criteria, 'limit');


    //  ╔═╗╔═╗╔╗╔╔═╗╦═╗╔═╗╔╦╗╔═╗  ┌┐┌┌─┐┌┐┌   ┌─┐┌─┐┌─┐┬┌┐┌┌─┐┌┬┐┌─┐┌┬┐
    //  ║ ╦║╣ ║║║║╣ ╠╦╝╠═╣ ║ ║╣   ││││ ││││───├─┘├─┤│ ┬││││├─┤ │ ├┤  ││
    //  ╚═╝╚═╝╝╚╝╚═╝╩╚═╩ ╩ ╩ ╚═╝  ┘└┘└─┘┘└┘   ┴  ┴ ┴└─┘┴┘└┘┴ ┴ ┴ └─┘─┴┘
    //  ┌┬┐┬ ┬┌─┐┌─┐  ┌┬┐┬ ┬┌─┐   ┬┌─┐┬┌┐┌  ┌┬┐┌─┐┌┬┐┌─┐┬  ┌─┐┌┬┐┌─┐
    //   │ └┬┘├─┘├┤    │ ││││ │   ││ │││││   │ ├┤ │││├─┘│  ├─┤ │ ├┤
    //   ┴  ┴ ┴  └─┘   ┴ └┴┘└─┘  └┘└─┘┴┘└┘   ┴ └─┘┴ ┴┴  ┴─┘┴ ┴ ┴ └─┘
    // If the join isn't using a join table and there isn't a `skip` or `limit`
    // criteria, a simple IN query can be built.
    if (strategy === 2 && !paginated) {
      (function generateTemplate() {
        // Ensure the criteria has a WHERE clause to make it valid
        if (!_.has(parentInstructions.criteria, 'where')) {
          parentInstructions.criteria.where = {};
        }

        // Convert the query to a statement
        try {
          statement = Converter({
            model: parentInstructions.child,
            method: 'find',
            criteria: parentInstructions.criteria,
            opts: {
              schema: schemaName
            }
          });
        } catch (e) {
          throw new Error('There was an error converting the Waterline Query into a Waterline Statement. ' + e.stack);
        }

        // Mixin the select from the top level instructions
        statement.select = parentInstructions.select;

        // Add in a WHERE IN template that can be rendered before compiling the
        // statement to include the primary keys of the parent.
        // This gives you a query like the following example:
        //
        // SELECT user.id from pet where pet.user_id IN [1,2,3,4];
        try {
          primaryKeyAttr = getPk(parentInstructions.child);
        } catch (e) {
          throw new Error('There was an issue getting the primary key attribute from ' + parentInstructions.child + ' are ' +
          'you sure the getPk function is working correctly? It should accept a single argument which reperents the ' +
          'tableName and should return a string of the column name that is set as the primary key of the table. \n\n' + e.stack);
        }

        // Build an IN template
        whereTemplate[parentInstructions.childKey] = {
          in: []
        };

        statement.where = statement.where || {};
        statement.where.and = statement.where.and || [];
        statement.where.and.push(whereTemplate);

        // Add the statement to the childStatements array
        childStatements.push({
          queryType: 'in',
          primaryKeyAttr: primaryKeyAttr,
          statement: statement,
          instructions: parentInstructions,
          alias: alias
        });
      })();
    }


    //  ╔═╗╔═╗╔╗╔╔═╗╦═╗╔═╗╔╦╗╔═╗  ┌─┐┌─┐┌─┐┬┌┐┌┌─┐┌┬┐┌─┐┌┬┐
    //  ║ ╦║╣ ║║║║╣ ╠╦╝╠═╣ ║ ║╣   ├─┘├─┤│ ┬││││├─┤ │ ├┤  ││
    //  ╚═╝╚═╝╝╚╝╚═╝╩╚═╩ ╩ ╩ ╚═╝  ┴  ┴ ┴└─┘┴┘└┘┴ ┴ ┴ └─┘─┴┘
    //  ┌┬┐┬ ┬┌─┐┌─┐  ┌┬┐┬ ┬┌─┐   ┬┌─┐┬┌┐┌  ┌┬┐┌─┐┌┬┐┌─┐┬  ┌─┐┌┬┐┌─┐
    //   │ └┬┘├─┘├┤    │ ││││ │   ││ │││││   │ ├┤ │││├─┘│  ├─┤ │ ├┤
    //   ┴  ┴ ┴  └─┘   ┴ └┴┘└─┘  └┘└─┘┴┘└┘   ┴ └─┘┴ ┴┴  ┴─┘┴ ┴ ┴ └─┘
    // If the join isn't using a join table but IS paginated then a big union query
    // will need to be generated. Generate a template for what a single piece of
    // the UNION ALL query will look like.
    if (strategy === 2 && paginated) {
      (function generateTemplate() {
        // Ensure the criteria has a WHERE clause to make it valid
        if (!_.has(parentInstructions.criteria, 'where')) {
          parentInstructions.criteria.where = {};
        }

        try {
          statement = Converter({
            model: parentInstructions.child,
            method: 'find',
            criteria: parentInstructions.criteria,
            opts: {
              schema: schemaName
            }
          });
        } catch (e) {
          throw new Error('There was an error converting the Waterline Query into a Waterline Statement.' + e.stack);
        }

        // Mixin the select from the top level instructions
        statement.select = parentInstructions.select;

        try {
          primaryKeyAttr = getPk(parentInstructions.child);
        } catch (e) {
          throw new Error('There was an issue getting the primary key attribute from ' + parentInstructions.child + ' are ' +
          'you sure the getPk function is working correctly? It should accept a single argument which reperents the ' +
          'tableName and should return a string of the column name that is set as the primary key of the table. \n\n' + e.stack);
        }

        // When using the UNION ALL type queries each query needs a where clause that
        // matches a single parent's primary key value. Use a ? for now and replace
        // it later with a real value.
        whereTemplate[parentInstructions.childKey] = '?';

        statement.where = statement.where || {};
        statement.where.and = statement.where.and || [];
        statement.where.and.push(whereTemplate);

        childStatements.push({
          queryType: 'union',
          primaryKeyAttr: primaryKeyAttr,
          statement: statement,
          instructions: parentInstructions,
          alias: alias
        });
      })();
    }


    // If the joins are using a join table then the statement template will need
    // the additional leftOuterJoin piece.

    // Grab the parent instructions
    var childInstructions = _.last(instructions.instructions);

    // Check if the child is paginated
    var childPaginated = _.has(childInstructions.criteria, 'skip') || _.has(childInstructions.criteria, 'limit');


    //  ╔═╗╔═╗╔╗╔╔═╗╦═╗╔═╗╔╦╗╔═╗  ┌┐┌┌─┐┌┐┌   ┌─┐┌─┐┌─┐┬┌┐┌┌─┐┌┬┐┌─┐┌┬┐
    //  ║ ╦║╣ ║║║║╣ ╠╦╝╠═╣ ║ ║╣   ││││ ││││───├─┘├─┤│ ┬││││├─┤ │ ├┤  ││
    //  ╚═╝╚═╝╝╚╝╚═╝╩╚═╩ ╩ ╩ ╚═╝  ┘└┘└─┘┘└┘   ┴  ┴ ┴└─┘┴┘└┘┴ ┴ ┴ └─┘─┴┘
    //  ┌┬┐┬ ┬┌─┐┌─┐  ┌┬┐┬ ┬┬─┐┌─┐┌─┐   ┬┌─┐┬┌┐┌  ┌┬┐┌─┐┌┬┐┌─┐┬  ┌─┐┌┬┐┌─┐
    //   │ └┬┘├─┘├┤    │ ├─┤├┬┘├┤ ├┤    ││ │││││   │ ├┤ │││├─┘│  ├─┤ │ ├┤
    //   ┴  ┴ ┴  └─┘   ┴ ┴ ┴┴└─└─┘└─┘  └┘└─┘┴┘└┘   ┴ └─┘┴ ┴┴  ┴─┘┴ ┴ ┴ └─┘
    // If the join criteria isn't paginated an IN query can be used.
    if (strategy === 3 && !childPaginated) {
      (function generateTemplate() {
        // Ensure the criteria has a WHERE clause to make it valid
        if (!_.has(childInstructions.criteria, 'where')) {
          childInstructions.criteria.where = {};
        }

        // The WHERE IN template for many to many queries is a little bit different.
        // Instead of using the primary key of the parent the parent key of the
        // join table is used.
        whereTemplate[parentInstructions.childKey] = {
          in: []
        };

        var modifiedInstructions =  _.merge({}, criteria.instructions);
        modifiedInstructions[alias].instructions = [childInstructions];

        // Add the modified instructions to the criteria of the child instructions.
        childInstructions.criteria.instructions = modifiedInstructions;

        // Convert the query to a statement
        try {
          statement = Converter({
            model: parentInstructions.child,
            method: 'find',
            criteria: childInstructions.criteria,
            opts: {
              schema: schemaName
            }
          });
        } catch (e) {
          throw new Error('There was an error converting the Waterline Query into a Waterline Statement. ' + e.stack);
        }

        // Mixin the select from the top level instructions and make sure the correct
        // table name is prepended to it.
        statement.select = _.map(childInstructions.select, function normalizeSelect(column) {
          return childInstructions.child + '.' + column;
        });

        // Mixin the Where IN template logic
        statement.where = statement.where || {};
        statement.where.and = statement.where.and || [];
        statement.where.and.push(whereTemplate);

        // Add in the generated foriegn key select value so the records can be
        // nested together correctly.
        var selectStr = parentInstructions.child + '.' + parentInstructions.childKey + ' as _parent_fk';
        statement.select.push(selectStr);

        // Add the statement to the childStatements array
        childStatements.push({
          queryType: 'in',
          statement: statement,
          instructions: [parentInstructions, childInstructions],
          alias: alias
        });
      })();
    }


    //  ╔═╗╔═╗╔╗╔╔═╗╦═╗╔═╗╔╦╗╔═╗  ┌─┐┌─┐┌─┐┬┌┐┌┌─┐┌┬┐┌─┐┌┬┐
    //  ║ ╦║╣ ║║║║╣ ╠╦╝╠═╣ ║ ║╣   ├─┘├─┤│ ┬││││├─┤ │ ├┤  ││
    //  ╚═╝╚═╝╝╚╝╚═╝╩╚═╩ ╩ ╩ ╚═╝  ┴  ┴ ┴└─┘┴┘└┘┴ ┴ ┴ └─┘─┴┘
    //  ┌┬┐┬ ┬┌─┐┌─┐  ┌┬┐┬ ┬┬─┐┌─┐┌─┐   ┬┌─┐┬┌┐┌  ┌┬┐┌─┐┌┬┐┌─┐┬  ┌─┐┌┬┐┌─┐
    //   │ └┬┘├─┘├┤    │ ├─┤├┬┘├┤ ├┤    ││ │││││   │ ├┤ │││├─┘│  ├─┤ │ ├┤
    //   ┴  ┴ ┴  └─┘   ┴ ┴ ┴┴└─└─┘└─┘  └┘└─┘┴┘└┘   ┴ └─┘┴ ┴┴  ┴─┘┴ ┴ ┴ └─┘
    // If the join criteria is paginated a very complex and slow UNION ALL query
    // must be built.
    if (strategy === 3 && childPaginated) {
      (function generateTemplate() {
        // Ensure the criteria has a WHERE clause to make it valid
        if (!_.has(childInstructions.criteria, 'where')) {
          childInstructions.criteria.where = {};
        }

        var modifiedInstructions =  _.merge({}, criteria.instructions);
        modifiedInstructions[alias].instructions = [childInstructions];

        // Add the modified instructions to the criteria of the child instructions.
        childInstructions.criteria.instructions = modifiedInstructions;

        try {
          statement = Converter({
            model: parentInstructions.child,
            method: 'find',
            criteria: childInstructions.criteria,
            opts: {
              schema: schemaName
            }
          });
        } catch (e) {
          throw new Error('There was an error converting the Waterline Query into a Waterline Statement.' + e.stack);
        }

        // When using the UNION ALL type queries each query needs a where clause that
        // matches a single parent's primary key value. Use a ? for now and replace
        // it later with a real value.
        whereTemplate[parentInstructions.childKey] = '?';

        // Mixin the select from the top level instructions and make sure the correct
        // table name is prepended to it.
        statement.select = _.map(childInstructions.select, function normalizeSelect(column) {
          return childInstructions.child + '.' + column;
        });

        // Mixin the Where IN template logic
        statement.where = statement.where || {};
        statement.where.and = statement.where.and || [];
        statement.where.and.push(whereTemplate);

        // Add in the generated foriegn key select value so the records can be
        // nested together correctly.
        var selectStr = parentInstructions.child + '.' + parentInstructions.childKey + ' as _parent_fk';
        statement.select.push(selectStr);

        childStatements.push({
          queryType: 'union',
          strategy: strategy,
          primaryKeyAttr: parentInstructions.childKey,
          statement: statement,
          instructions: instructions.instructions,
          alias: alias
        });
      })();
    }
  });


  return {
    parentStatement: parentStatement,
    childStatements: childStatements
  };
};
