module.exports = {
  query: {
    tokenizer: require('./lib/query/tokenizer'),
    analyzer: require('./lib/query/analyzer'),
    converter: require('./lib/query/converter')
  },
  joins: {
    planner: require('./lib/joins/planner'),
    queryCache: require('./lib/joins/query-cache'),
    expandCriteria: require('./lib/joins/expand-criteria'),
    detectChildrenRecords: require('./lib/joins/detect-children-records')
  }
};
