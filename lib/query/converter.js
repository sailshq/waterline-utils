//   ██████╗ ██████╗ ███╗   ██╗██╗   ██╗███████╗██████╗ ████████╗███████╗██████╗
//  ██╔════╝██╔═══██╗████╗  ██║██║   ██║██╔════╝██╔══██╗╚══██╔══╝██╔════╝██╔══██╗
//  ██║     ██║   ██║██╔██╗ ██║██║   ██║█████╗  ██████╔╝   ██║   █████╗  ██████╔╝
//  ██║     ██║   ██║██║╚██╗██║╚██╗ ██╔╝██╔══╝  ██╔══██╗   ██║   ██╔══╝  ██╔══██╗
//  ╚██████╗╚██████╔╝██║ ╚████║ ╚████╔╝ ███████╗██║  ██║   ██║   ███████╗██║  ██║
//   ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
//
// The Converter takes a Waterline query and converts it into a Waterline
// statement. The difference may sound tiny but it's important. The way
// Waterline currently works is that it takes up to four seperate pieces to
// build a query: modelName, method, criteria, and possibly values.
//
// A Waterline statement is an object that encompasses the entire query. It can
// easily be transformed into a native query such as a SQL string or a Mongo
// object. It more closely represents a native query and is much easier to
// validate. Going forward Waterline will move more and more to having end users
// work with statements.

var _ = require('lodash');

module.exports = function convert(options) {
  var model = options.model;
  var method = options.method;
  var criteria = options.criteria;
  var values = options.values;
  var opts = options.opts || undefined;

  // Hold the final query value
  var query = {};

  // Validate options
  if (!model) {
    throw new Error('Convert must contain a model to use to build the query.');
  }

  if (!method) {
    throw new Error('Convert must contain a method to use to build the query.');
  }

  // Validate Criteria Input is a dictionary
  if (criteria && !_.isPlainObject(criteria)) {
    throw new Error('Criteria must be a dictionary.');
  }

  // Validate Criteria Input contains a WHERE clause
  if (criteria && _.keys(criteria).length && !_.has(criteria, 'where')) {
    throw new Error('Criteria must contain a WHERE clause.');
  }


  //  ╔╦╗╔═╗╔╦╗╦╔═╗╦╔═╗╦═╗╔═╗
  //  ║║║║ ║ ║║║╠╣ ║║╣ ╠╦╝╚═╗
  //  ╩ ╩╚═╝═╩╝╩╚  ╩╚═╝╩╚═╚═╝

  if (criteria && _.keys(criteria).length) {
    if (_.has(criteria, 'skip')) {
      query.skip = criteria.skip;
    }

    // Sort should be pre-normalized coming from Waterline
    if (_.has(criteria, 'sort')) {
      query.orderBy = criteria.sort;
    }

    if (_.has(criteria, 'limit')) {
      query.limit = criteria.limit;
    }
  }

  //  ╔╗╔╔═╗╦═╗╔╦╗╔═╗╦  ╦╔═╗╔═╗
  //  ║║║║ ║╠╦╝║║║╠═╣║  ║╔═╝║╣
  //  ╝╚╝╚═╝╩╚═╩ ╩╩ ╩╩═╝╩╚═╝╚═╝
  //
  // Criteria must always contain a top-level AND or OR clause. Check that it
  // exists and if not normalize it. If there is more than one value always wrap
  // it in an AND clause. If there is only a single OR value then it's fine.
  if (criteria && _.keys(criteria).length) {
    var _criteria;

    // Check the key length. If there is more than one key build up an AND clause
    // and wrap up the criteria logic.
    if (_.keys(criteria.where).length > 0) {
      (function normalizeWhereCriteria() {
        // If this is an OR clause then everything is ok
        if (_.keys(criteria.where).length === 1 && _.has(criteria.where, 'or')) {
          return;
        }

        // Otherwise the query needs to contain an AND clause
        _criteria = {
          and: []
        };

        // Build up the WHERE clause by seperating out all of the keys.
        _.each(criteria.where, function processWhereClause(val, key) {
          var obj = {};
          obj[key] = val;
          _criteria.and.push(obj);
        });

        criteria.where = _criteria;
      })();

    // If there isn't a WHERE clause, delete the criteria altogether
    } else {
      delete criteria.where;
    }
  }


  //  ╔═╗╦═╗╔═╗╔═╗╔╦╗╔═╗
  //  ║  ╠╦╝║╣ ╠═╣ ║ ║╣
  //  ╚═╝╩╚═╚═╝╩ ╩ ╩ ╚═╝
  //
  // Process a CREATE query and build a WQL insert query
  var processCreate = function processCreate() {
    query.into = model;
    query.insert = values || {};

    // Add the opts
    if (opts) {
      query.opts = opts;
    }
  };


  //  ╔═╗╦╔╗╔╔╦╗
  //  ╠╣ ║║║║ ║║
  //  ╚  ╩╝╚╝═╩╝
  //
  // Process a FIND or FINDONE query and build a WQL select query.
  var processFind = function processFind(criteria) {
    query.select = criteria.select || [];
    query.from = model;
    query.where = criteria.where || {};

    // If there are any joins add them as well
    if (_.has(criteria, 'instructions')) {
      // First be sure to update the select so there are no ambiguous columns
      query.select = _.map(query.select, function remapSelect(key) {
        return model + '.' + key;
      });

      // Ensure values only exist once
      query.select = _.uniq(query.select);

      // Process Joins
      processJoins(criteria);
    }

    // Add the opts
    if (opts) {
      query.opts = opts;
    }
  };


  //  ╔╦╗╔═╗╔═╗╔╦╗╦═╗╔═╗╦ ╦
  //   ║║║╣ ╚═╗ ║ ╠╦╝║ ║╚╦╝
  //  ═╩╝╚═╝╚═╝ ╩ ╩╚═╚═╝ ╩
  //
  // Process a DESTROY query and a build a WQL destroy query.
  var processDestroy = function processDestroy(criteria) {
    query.del = true;
    query.from = model;
    query.where = criteria.where || {};

    // Add the opts
    if (opts) {
      query.opts = opts;
    }
  };


  //  ╦ ╦╔═╗╔╦╗╔═╗╔╦╗╔═╗
  //  ║ ║╠═╝ ║║╠═╣ ║ ║╣
  //  ╚═╝╩  ═╩╝╩ ╩ ╩ ╚═╝
  //
  // Process an UPDATE query and a build a WQL update query.
  var processUpdate = function processUpdate(criteria) {
    query.update = values || {};
    query.using = model;
    query.where = criteria.where || {};

    // Add the opts
    if (opts) {
      query.opts = opts;
    }
  };


  //  ╔═╗╦═╗╔═╗╔═╗╔═╗╔═╗╔═╗  ╔═╗╦  ╦╔═╗╦═╗╔═╗╔═╗╔═╗
  //  ╠═╝╠╦╝║ ║║  ║╣ ╚═╗╚═╗  ╠═╣╚╗╔╝║╣ ╠╦╝╠═╣║ ╦║╣
  //  ╩  ╩╚═╚═╝╚═╝╚═╝╚═╝╚═╝  ╩ ╩ ╚╝ ╚═╝╩╚═╩ ╩╚═╝╚═╝
  //
  // Process an AVERAGE aggregation. In WQL you can only average by one field
  // at a time so if the array contains more than one item, throw an error.
  //
  // If any of `skip`, `sort`, or `limit` is used, a table subquery will be
  // created to prevent any weird `groupBy` logic and stick with only returning
  // a single value.
  var processAverage = function processAverage(criteria) {
    query.avg = values || '';

    // Check is a subquery is needed
    (function determineSubQueryUsage() {
      var subQuery = false;
      if (_.has(query, 'skip') || _.has(query, 'sort') || _.has(query, 'limit')) {
        subQuery = true;
      }

      // If no subquery is needed, a simple query statement can be generated
      if (!subQuery) {
        query.from = model;

        // Add a where clause
        if (_.has(criteria, 'where')) {
          query.where = criteria.where || {};
        }

        // Add the opts
        if (opts) {
          query.opts = opts;
        }

        return;
      }

      // Otherwise a subquery must be used
      query.avg = values || '';
      query.from = {
        select: [values],
        from: model
      };

      // Add the top-level criteria pieces to the sub-query and remove them
      // from the top-level.
      if (_.has(query, 'skip')) {
        query.from.skip = query.skip;
        delete query.skip;
      }

      if (_.has(query, 'limit')) {
        query.from.limit = query.limit;
        delete query.limit;
      }

      if (_.has(query, 'orderBy')) {
        query.from.orderBy = query.orderBy;
        delete query.orderBy;
      }

      // Add a where clause
      if (_.has(criteria, 'where')) {
        query.from.where = criteria.where || {};
      }

      // Add the opts
      if (opts) {
        query.from.opts = opts;
      }

      // Set the "AS" clause so subquery will be run correctly
      query.from.as = 'avg';
    })();
  };


  //  ╔═╗╦═╗╔═╗╔═╗╔═╗╔═╗╔═╗  ╔═╗╦═╗╦╔╦╗╔═╗╦═╗╦╔═╗
  //  ╠═╝╠╦╝║ ║║  ║╣ ╚═╗╚═╗  ║  ╠╦╝║ ║ ║╣ ╠╦╝║╠═╣
  //  ╩  ╩╚═╚═╝╚═╝╚═╝╚═╝╚═╝  ╚═╝╩╚═╩ ╩ ╚═╝╩╚═╩╩ ╩
  //
  // The meat and potatoes of the converter. Takes an existing Waterline
  // criteria object and builds up something that can be used with the
  // Waterline Query Language.
  var processCriteria = function processCriteria(criteria) {
    // Loop through the criteria looking for IN arrays
    _.each(criteria, function process(val, key) {
      // Normalize ! to !=
      if (key === '!') {
        delete criteria[key];
        criteria['!='] = val;
        key = '!=';
      }

      // Normalize !== to !=
      if (key === '!==') {
        delete criteria[key];
        criteria['!='] = val;
        key = '!=';
      }

      // If this is a LIKE query, just run through the criteria and set LIKE
      // inside the value instead of outside it.
      if (key === 'like') {
        _.each(val, function normalizeLike(attrVal, attrKey) {
          val[attrKey] = {};
          val[attrKey].like = attrVal;
        });

        delete criteria.like;
        criteria = _.merge(criteria, val);

        return criteria;
      }

      // If this is a CONTAINS query, convert it to a LIKE query
      if (key === 'contains') {
        criteria = { like: '%' + val + '%' };
        return criteria;
      }

      // If this is an ENDSWITH query, convert it to a LIKE query
      if (key === 'endsWith') {
        criteria = { like: '%' + val };
        return criteria;
      }

      // If this is an STARTSWITH query, convert it to a LIKE query
      if (key === 'startsWith') {
        criteria = { like: val + '%' };
        return criteria;
      }

      // Check for a != clause by grabbing the keys and checking for a !=
      // value. If a != is used, no other modifiers may be used here.
      if (_.isPlainObject(val)) {
        var notModifier = _.includes(_.keys(val), '!=') || _.includes(_.keys(val), '!');
        if (notModifier && _.keys(val).length > 1) {
          var notError = new Error('When using a NOT EQUAL modifier it may not be used with other modifiers on an attribute in the same clause.');
          notError.code = 'invalidCriteria';
          throw new Error(notError);
        }

        // If a NOT modifier is used, process it correctly
        if (notModifier) {
          // Normalize legacy modifier
          if (val['!']) {
            val['!='] = val['!'];
            delete val['!'];
          }

          // Figure out if the key should be renamed to nin
          var keyName = _.isArray(val['!=']) ? 'nin' : '!=';
          var notCriteria = {};
          notCriteria[keyName] = val['!='];

          // Set the criteria value
          criteria[key] = notCriteria;
          return;
        }
      }

      // Recurse through the criteria
      if (_.isPlainObject(val)) {
        criteria[key] = processCriteria(val);
        return;
      }

      // Handle OR criteria
      if ((key === 'or' || key === 'and') && _.isArray(val)) {
        _.each(val, function processOrClause(clause) {
          processCriteria(clause);
        });

        return criteria;
      }

      // Handle generic IN condition
      if (key !== 'or' && key !== 'and' && _.isArray(val)) {
        criteria[key] = {
          in: val
        };
      }

      // Handle normalizing spelled out operators
      if (key === 'greaterThan') {
        criteria['>'] = val;
        delete criteria[key];
      }

      if (key === 'lessThan') {
        criteria['<'] = val;
        delete criteria[key];
      }

      if (key === 'greaterThanOrEqual') {
        criteria['>='] = val;
        delete criteria[key];
      }

      if (key === 'lessThanOrEqual') {
        criteria['<='] = val;
        delete criteria[key];
      }

      return criteria;
    });

    return criteria;
  };


  //  ╔═╗╦═╗╔═╗╔═╗╔═╗╔═╗╔═╗   ┬┌─┐┬┌┐┌┌─┐
  //  ╠═╝╠╦╝║ ║║  ║╣ ╚═╗╚═╗   ││ │││││└─┐
  //  ╩  ╩╚═╚═╝╚═╝╚═╝╚═╝╚═╝  └┘└─┘┴┘└┘└─┘
  //
  // When a find query contains an instruction set, build up a set of joins for
  // the query to use.
  var processJoins = function processJoins(criteria) {
    if (!_.isPlainObject(criteria.instructions)) {
      throw new Error('Join instructions are in an invalid format. They must contain a dictionary of operations.');
    }

    // Build an array to hold all the normalized join instructions
    var joins = [];

    _.each(criteria.instructions, function processJoinSet(join) {
      var strategy = join.strategy && join.strategy.strategy;
      if (!strategy) {
        throw new Error('Join instructions are missing a valid strategy.');
      }

      _.each(join.instructions, function buildJoin(instructions) {
        var obj = {};
        obj.from = instructions.child;
        obj.on = {};
        obj.on[instructions.parent] = instructions.parentKey;
        obj.on[instructions.child] = instructions.childKey;

        // If there is a select on the instructions, move the select to the
        // top level and append each item with the child name.
        if (instructions.select && instructions.select.length) {
          var _select = _.map(instructions.select, function mapSelect(col) {
            return instructions.child + '.' + col + ' as ' + instructions.alias + '__' + col;
          });

          // Concat the select on the main criteria
          query.select = _.uniq(query.select.concat(_select));
        }

        joins.push(obj);
      });
    });

    query.leftOuterJoin = joins;
  };


  //  ╔╗ ╦ ╦╦╦  ╔╦╗  ╔═╗ ╦ ╦╔═╗╦═╗╦ ╦
  //  ╠╩╗║ ║║║   ║║  ║═╬╗║ ║║╣ ╠╦╝╚╦╝
  //  ╚═╝╚═╝╩╩═╝═╩╝  ╚═╝╚╚═╝╚═╝╩╚═ ╩
  //
  var buildQuery = function buildQuery() {
    // If there was any criteria, process it
    var _criteria = criteria || {};
    if (_.has(_criteria, 'where')) {
      _criteria.where = processCriteria(_criteria.where);
    }

    switch (method) {
      case 'create':
        processCreate();
        break;

      case 'find':
      case 'findOne':
        processFind(_criteria);
        break;

      case 'destroy':
        processDestroy(_criteria);
        break;

      case 'update':
        processUpdate(_criteria);
        break;

      case 'avg':
        processAverage(_criteria);
        break;
    }
  };

  // Build the query
  buildQuery();


  // Delete any SKIP 0 clauses
  if (_.has(query.where, 'skip') && query.where.skip === 0) {
    delete query.where.skip;
  }

  // Return the result
  return query;
};
