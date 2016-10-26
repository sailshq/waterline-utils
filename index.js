module.exports = {
  query: {
    tokenizer: require('./lib/query/tokenizer'),
    analyzer: require('./lib/query/analyzer'),
    converter: require('./lib/query/converter')
  }
};
