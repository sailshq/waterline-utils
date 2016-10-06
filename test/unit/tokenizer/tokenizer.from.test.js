var Tokenizer = require('../../../index').tokenizer;
var assert = require('assert');

describe('Tokenizer ::', function() {
  describe('FROM statements', function() {
    it('should generate a valid token array when FROM is used', function(done) {
      Tokenizer({
        expression: {
          select: '*',
          from: 'books'
        }
      })
      .exec(function(err, result) {
        assert(!err);

        assert.deepEqual(result, [
          { type: 'IDENTIFIER', value: 'SELECT' },
          { type: 'VALUE', value: '*' },
          { type: 'ENDIDENTIFIER', value: 'SELECT' },
          { type: 'IDENTIFIER', value: 'FROM' },
          { type: 'VALUE', value: 'books' },
          { type: 'ENDIDENTIFIER', value: 'FROM' }
        ]);

        return done();
      });
    });
  });
});
