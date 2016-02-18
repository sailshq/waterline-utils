var Analyzer = require('../../index').analyzer;
var tokenize = require('../support/tokenize');
var assert = require('assert');

describe('Analyzer ::', function() {
  describe('Grouping statements with AND', function() {
    it('should generate a valid group when AND is used as an array', function(done) {
      var tokens = tokenize({
        select: ['*'],
        from: 'users',
        where: {
          and: [
            {
              firstName: 'foo'
            },
            {
              lastName: 'bar'
            }
          ]
        }
      });

      Analyzer({
        tokens: tokens
      })
      .exec(function(err, result) {
        assert(!err);

        assert.deepEqual(result,  [
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
            { type: 'CONDITION', value: 'AND' },
            [
              { type: 'KEY', value: 'firstName' },
              { type: 'VALUE', value: 'foo' }
            ],
            [
              { type: 'KEY', value: 'lastName' },
              { type: 'VALUE', value: 'bar' }
            ]
          ]
        ]);

        return done();
      });
    });

    it('should generate a valid group when using nested OR conditions', function(done) {
      var tokens = tokenize({
        select: ['*'],
        from: 'users',
        where: {
          and: [
            {
              or: [
                {
                  firstName: 'John'
                },
                {
                  lastName: 'Smith'
                }
              ]
            },
            {
              or: [
                {
                  qty: {
                    '>': 100
                  }
                },
                {
                  price: {
                    '<': 10.00
                  }
                }
              ]
            }
          ]
        }
      });

      Analyzer({
        tokens: tokens
      })
      .exec(function(err, result) {
        assert(!err);

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
            { type: 'CONDITION', value: 'AND' },
            [
              [
                { type: 'KEY', value: 'firstName' },
                { type: 'VALUE', value: 'John' }
              ],
              [
                { type: 'KEY', value: 'lastName' },
                { type: 'VALUE', value: 'Smith' }
              ]
            ],
            [
              [
                { type: 'KEY', value: 'qty' },
                { type: 'OPERATOR', value: '>' },
                { type: 'VALUE', value: 100 }
              ],
              [
                { type: 'KEY', value: 'price' },
                { type: 'OPERATOR', value: '<' },
                { type: 'VALUE', value: 10.00 }
              ]
            ]
          ]
        ]);

        return done();
      });
    });
  });
});
