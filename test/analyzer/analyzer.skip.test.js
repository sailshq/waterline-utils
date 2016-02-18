var Analyzer = require('../../index').analyzer;
var tokenize = require('../support/tokenize');
var assert = require('assert');

describe('Analyzer ::', function() {
  describe('SKIP statements', function() {
    it('should generate a valid group when SKIP is used', function(done) {
      var tokens = tokenize({
        select: '*',
        from: 'users',
        skip: 10
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
            { type: 'IDENTIFIER', value: 'SKIP' },
            { type: 'VALUE', value: 10 }
          ]
        ]);

        return done();
      });
    });
  });
});
