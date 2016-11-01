var Analyzer = require('../../../index').query.analyzer;
var tokenize = require('../../support/tokenize');
var assert = require('assert');

describe('Analyzer ::', function() {
  describe('WHERE NOT statements', function() {
    it('should generate a valid group', function() {
      var tokens = tokenize({
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

      var result = Analyzer(tokens);

      assert.deepEqual(result, [
        [
          { type: 'IDENTIFIER', value: 'SELECT' },
          { type: 'VALUE', value: 'id' }
        ],
        [
          { type: 'IDENTIFIER', value: 'FROM' },
          { type: 'VALUE', value: 'users' }
        ],
        [
          { type: 'IDENTIFIER', value: 'WHERE' },
          { type: 'CONDITION', value: 'AND' },
          [
            { type: 'KEY', value: 'firstName' },
            { type: 'CONDITION', value: 'NOT' },
            { type: 'VALUE', value: 'Test' }
          ],
          [
            { type: 'KEY', value: 'lastName' },
            { type: 'CONDITION', value: 'NOT' },
            { type: 'VALUE', value: 'User' }
          ]
        ]
      ]);
    });

    it('should generate a valid group when nested NOT statements are used', function() {
      var tokens = tokenize({
        select: ['*'],
        from: 'users',
        where: {
          or: [
            {
              or: [
                {
                  id: 1
                },
                {
                  id: {
                    '<': 10
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

      var result = Analyzer(tokens);

      assert.deepEqual(result, [
        [
          { type: 'IDENTIFIER', value: 'SELECT' },
          { type: 'VALUE', value: '*' }
        ],
        [
          { type: 'IDENTIFIER', value: 'FROM' },
          { type: 'VALUE', value: 'users' }
        ],
        [
          { type: 'IDENTIFIER', value: 'WHERE' },
          [
            [
              { type: 'KEY', value: 'id' },
              { type: 'VALUE', value: 1 }
            ],
            [
              { type: 'KEY', value: 'id' },
              { type: 'OPERATOR', value: '<' },
              { type: 'VALUE', value: 10 }
            ]
          ],
          [
            { type: 'KEY', value: 'name' },
            { type: 'CONDITION', value: 'NOT' },
            { type: 'VALUE', value: 'Tester' }
          ]
        ]
      ]);
    });

    it('should generate a valid group when multiple conditionals are used', function() {
      var tokens = tokenize({
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

      var result = Analyzer(tokens);

      assert.deepEqual(result, [
        [
          { type: 'IDENTIFIER', value: 'SELECT' },
          { type: 'VALUE', value: '*' }
        ],
        [
          { type: 'IDENTIFIER', value: 'FROM' },
          { type: 'VALUE', value: 'users' }
        ],
        [
          { type: 'IDENTIFIER', value: 'WHERE' },
          [
            { type: 'KEY', value: 'name' },
            { type: 'VALUE', value: 'John' }
          ],
          [
            { type: 'KEY', value: 'votes' },
            { type: 'OPERATOR', value: '>' },
            { type: 'VALUE', value: 100 },
            { type: 'KEY', value: 'title' },
            { type: 'CONDITION', value: 'NOT' },
            { type: 'VALUE', value: 'Admin' }
          ]
        ]
      ]);
    });
  });
});
