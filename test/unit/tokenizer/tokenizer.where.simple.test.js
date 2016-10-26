var Tokenizer = require('../../../index').query.tokenizer;
var assert = require('assert');

describe('Tokenizer ::', function() {
  describe('Simple WHERE statements', function() {
    it('should generate a valid token array', function() {
      var result = Tokenizer({
        select: ['id'],
        where: {
          firstName: 'Test',
          lastName: 'User'
        },
        from: 'users'
      });

      assert.deepEqual(result, [
        { type: 'IDENTIFIER', value: 'SELECT' },
        { type: 'VALUE', value: 'id' },
        { type: 'ENDIDENTIFIER', value: 'SELECT' },
        { type: 'IDENTIFIER', value: 'WHERE' },
        { type: 'KEY', value: 'firstName' },
        { type: 'VALUE', value: 'Test' },
        { type: 'KEY', value: 'lastName' },
        { type: 'VALUE', value: 'User' },
        { type: 'ENDIDENTIFIER', value: 'WHERE' },
        { type: 'IDENTIFIER', value: 'FROM' },
        { type: 'VALUE', value: 'users' },
        { type: 'ENDIDENTIFIER', value: 'FROM' }
      ]);
    });

    it('should generate a valid token array when used with operators', function() {
      var result = Tokenizer({
        select: '*',
        where: {
          votes: { '>': 100 }
        },
        from: 'users'
      });

      assert.deepEqual(result,  [
        { type: 'IDENTIFIER', value: 'SELECT' },
        { type: 'VALUE', value: '*' },
        { type: 'ENDIDENTIFIER', value: 'SELECT' },
        { type: 'IDENTIFIER', value: 'WHERE' },
        { type: 'KEY', value: 'votes' },
        { type: 'OPERATOR', value: '>' },
        { type: 'VALUE', value: 100 },
        { type: 'ENDOPERATOR', value: '>' },
        { type: 'ENDIDENTIFIER', value: 'WHERE' },
        { type: 'IDENTIFIER', value: 'FROM' },
        { type: 'VALUE', value: 'users' },
        { type: 'ENDIDENTIFIER', value: 'FROM' }
      ]);
    });

    it('should generate a valid token array when used with multiple operators', function() {
      var result = Tokenizer({
        select: '*',
        where: {
          votes: { '>': 100, '<': 200 }
        },
        from: 'users'
      });

      assert.deepEqual(result,  [
        { type: 'IDENTIFIER', value: 'SELECT' },
        { type: 'VALUE', value: '*' },
        { type: 'ENDIDENTIFIER', value: 'SELECT' },
        { type: 'IDENTIFIER', value: 'WHERE' },
        { type: 'KEY', value: 'votes' },
        { type: 'OPERATOR', value: '>' },
        { type: 'VALUE', value: 100 },
        { type: 'ENDOPERATOR', value: '>' },
        { type: 'KEY', value: 'votes' },
        { type: 'OPERATOR', value: '<' },
        { type: 'VALUE', value: 200 },
        { type: 'ENDOPERATOR', value: '<' },
        { type: 'ENDIDENTIFIER', value: 'WHERE' },
        { type: 'IDENTIFIER', value: 'FROM' },
        { type: 'VALUE', value: 'users' },
        { type: 'ENDIDENTIFIER', value: 'FROM' }
      ]);
    });

    it('should generate a valid token array when used with multiple columns and operators', function() {
      var result = Tokenizer({
        select: '*',
        where: {
          votes: { '>': 100 },
          age: { '<': 50 }
        },
        from: 'users'
      });

      assert.deepEqual(result,  [
        { type: 'IDENTIFIER', value: 'SELECT' },
        { type: 'VALUE', value: '*' },
        { type: 'ENDIDENTIFIER', value: 'SELECT' },
        { type: 'IDENTIFIER', value: 'WHERE' },
        { type: 'KEY', value: 'votes' },
        { type: 'OPERATOR', value: '>' },
        { type: 'VALUE', value: 100 },
        { type: 'ENDOPERATOR', value: '>' },
        { type: 'KEY', value: 'age' },
        { type: 'OPERATOR', value: '<' },
        { type: 'VALUE', value: 50 },
        { type: 'ENDOPERATOR', value: '<' },
        { type: 'ENDIDENTIFIER', value: 'WHERE' },
        { type: 'IDENTIFIER', value: 'FROM' },
        { type: 'VALUE', value: 'users' },
        { type: 'ENDIDENTIFIER', value: 'FROM' }
      ]);
    });
  });
});
