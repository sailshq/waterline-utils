var Tokenizer = require('../../../index').query.tokenizer;
var assert = require('assert');

describe('Tokenizer ::', function() {
  describe('WHERE NOT statements', function() {
    it('should generate a valid token array', function() {
      var result = Tokenizer({
        select: ['id'],
        from: 'users',
        where: {
          and: [
            {
              firstName: {
                not: 'Test'
              }
            },
            {
              lastName: {
                not: 'User'
              }
            }
          ]
        }
      });

      assert.deepEqual(result, [
        { type: 'IDENTIFIER', value: 'SELECT' },
        { type: 'VALUE', value: 'id' },
        { type: 'ENDIDENTIFIER', value: 'SELECT' },
        { type: 'IDENTIFIER', value: 'FROM' },
        { type: 'VALUE', value: 'users' },
        { type: 'ENDIDENTIFIER', value: 'FROM' },
        { type: 'IDENTIFIER', value: 'WHERE' },
        { type: 'CONDITION', value: 'AND' },
        { type: 'GROUP', value: 0 },
        { type: 'KEY', value: 'firstName' },
        { type: 'CONDITION', value: 'NOT' },
        { type: 'VALUE', value: 'Test' },
        { type: 'ENDCONDITION', value: 'NOT' },
        { type: 'ENDGROUP', value: 0 },
        { type: 'GROUP', value: 1 },
        { type: 'KEY', value: 'lastName' },
        { type: 'CONDITION', value: 'NOT' },
        { type: 'VALUE', value: 'User' },
        { type: 'ENDCONDITION', value: 'NOT' },
        { type: 'ENDGROUP', value: 1 },
        { type: 'ENDCONDITION', value: 'AND' },
        { type: 'ENDIDENTIFIER', value: 'WHERE' }
      ]);
    });

    it('should generate a valid token array when nested NOT statements are used', function() {
      var result = Tokenizer({
        select: ['*'],
        from: 'users',
        where: {
          or: [
            {
              or: [
                {
                  id: {
                    not: 1
                  }
                },
                {
                  id: {
                    '>': 10
                  }
                }
              ]
            },
            {
              name: {
                not: 'Tester'
              }
            }
          ]
        }
      });

      assert.deepEqual(result, [
        { type: 'IDENTIFIER', value: 'SELECT' },
        { type: 'VALUE', value: '*' },
        { type: 'ENDIDENTIFIER', value: 'SELECT' },
        { type: 'IDENTIFIER', value: 'FROM' },
        { type: 'VALUE', value: 'users' },
        { type: 'ENDIDENTIFIER', value: 'FROM' },
        { type: 'IDENTIFIER', value: 'WHERE' },
        { type: 'CONDITION', value: 'OR' },
        { type: 'GROUP', value: 0 },
        { type: 'CONDITION', value: 'OR' },
        { type: 'GROUP', value: 0 },
        { type: 'KEY', value: 'id' },
        { type: 'CONDITION', value: 'NOT' },
        { type: 'VALUE', value: 1 },
        { type: 'ENDCONDITION', value: 'NOT' },
        { type: 'ENDGROUP', value: 0 },
        { type: 'GROUP', value: 1 },
        { type: 'KEY', value: 'id' },
        { type: 'OPERATOR', value: '>' },
        { type: 'VALUE', value: 10 },
        { type: 'ENDOPERATOR', value: '>' },
        { type: 'ENDGROUP', value: 1 },
        { type: 'ENDCONDITION', value: 'OR' },
        { type: 'ENDGROUP', value: 0 },
        { type: 'GROUP', value: 1 },
        { type: 'KEY', value: 'name' },
        { type: 'CONDITION', value: 'NOT' },
        { type: 'VALUE', value: 'Tester' },
        { type: 'ENDCONDITION', value: 'NOT' },
        { type: 'ENDGROUP', value: 1 },
        { type: 'ENDCONDITION', value: 'OR' },
        { type: 'ENDIDENTIFIER', value: 'WHERE' }
      ]);
    });

    it('should generate a valid token array when multiple operators are used', function() {
      var result = Tokenizer({
        select: ['*'],
        from: 'users',
        where: {
          or: [
            {
              name: 'John'
            },
            {
              votes: {
                '>': 100
              },
              title: {
                not: 'Admin'
              }
            }
          ]
        }
      });

      assert.deepEqual(result, [
        { type: 'IDENTIFIER', value: 'SELECT' },
        { type: 'VALUE', value: '*' },
        { type: 'ENDIDENTIFIER', value: 'SELECT' },
        { type: 'IDENTIFIER', value: 'FROM' },
        { type: 'VALUE', value: 'users' },
        { type: 'ENDIDENTIFIER', value: 'FROM' },
        { type: 'IDENTIFIER', value: 'WHERE' },
        { type: 'CONDITION', value: 'OR' },
        { type: 'GROUP', value: 0 },
        { type: 'KEY', value: 'name' },
        { type: 'VALUE', value: 'John' },
        { type: 'ENDGROUP', value: 0 },
        { type: 'GROUP', value: 1 },
        { type: 'KEY', value: 'votes' },
        { type: 'OPERATOR', value: '>' },
        { type: 'VALUE', value: 100 },
        { type: 'ENDOPERATOR', value: '>' },
        { type: 'KEY', value: 'title' },
        { type: 'CONDITION', value: 'NOT' },
        { type: 'VALUE', value: 'Admin' },
        { type: 'ENDCONDITION', value: 'NOT' },
        { type: 'ENDGROUP', value: 1 },
        { type: 'ENDCONDITION', value: 'OR' },
        { type: 'ENDIDENTIFIER', value: 'WHERE' }
      ]);
    });
  });
});
