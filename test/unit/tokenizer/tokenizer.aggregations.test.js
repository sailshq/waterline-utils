var Tokenizer = require('../../../index').query.tokenizer;
var assert = require('assert');

describe('Tokenizer ::', function() {
  describe('Aggregations', function() {
    it('should generate a valid token array for GROUP BY', function() {
      var result = Tokenizer({
        select: ['*'],
        from: 'users',
        groupBy: 'count'
      });

      assert.deepEqual(result, [
        { type: 'IDENTIFIER', value: 'SELECT' },
        { type: 'VALUE', value: '*' },
        { type: 'ENDIDENTIFIER', value: 'SELECT' },
        { type: 'IDENTIFIER', value: 'FROM' },
        { type: 'VALUE', value: 'users' },
        { type: 'ENDIDENTIFIER', value: 'FROM' },
        { type: 'IDENTIFIER', value: 'GROUPBY' },
        { type: 'VALUE', value: 'count' },
        { type: 'ENDIDENTIFIER', value: 'GROUPBY' }
      ]);
    });

    it('should generate a valid token array when MIN is used', function() {
      var result = Tokenizer({
        min: 'active',
        from: 'users'
      });

      assert.deepEqual(result,  [
        { type: 'IDENTIFIER', value: 'MIN' },
        { type: 'VALUE', value: 'active' },
        { type: 'ENDIDENTIFIER', value: 'MIN' },
        { type: 'IDENTIFIER', value: 'FROM' },
        { type: 'VALUE', value: 'users' },
        { type: 'ENDIDENTIFIER', value: 'FROM' }
      ]);
    });

    it('should generate a valid token array when MAX is used', function() {
      var result = Tokenizer({
        max: 'active',
        from: 'users'
      });

      assert.deepEqual(result,  [
        { type: 'IDENTIFIER', value: 'MAX' },
        { type: 'VALUE', value: 'active' },
        { type: 'ENDIDENTIFIER', value: 'MAX' },
        { type: 'IDENTIFIER', value: 'FROM' },
        { type: 'VALUE', value: 'users' },
        { type: 'ENDIDENTIFIER', value: 'FROM' }
      ]);
    });

    it('should generate a valid token array when SUM is used', function() {
      var result = Tokenizer({
        sum: 'active',
        from: 'users'
      });

      assert.deepEqual(result,  [
        { type: 'IDENTIFIER', value: 'SUM' },
        { type: 'VALUE', value: 'active' },
        { type: 'ENDIDENTIFIER', value: 'SUM' },
        { type: 'IDENTIFIER', value: 'FROM' },
        { type: 'VALUE', value: 'users' },
        { type: 'ENDIDENTIFIER', value: 'FROM' }
      ]);
    });

    it('should generate a valid token array when AVG is used', function() {
      var result = Tokenizer({
        avg: 'active',
        from: 'users'
      });

      assert.deepEqual(result,  [
        { type: 'IDENTIFIER', value: 'AVG' },
        { type: 'VALUE', value: 'active' },
        { type: 'ENDIDENTIFIER', value: 'AVG' },
        { type: 'IDENTIFIER', value: 'FROM' },
        { type: 'VALUE', value: 'users' },
        { type: 'ENDIDENTIFIER', value: 'FROM' }
      ]);
    });
  });
});
