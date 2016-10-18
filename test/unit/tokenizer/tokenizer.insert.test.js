var Tokenizer = require('../../../index').tokenizer;
var assert = require('assert');

describe('Tokenizer ::', function() {
  describe('INSERT statements', function() {
    it('should generate a valid token array for an INSERT is used', function() {
      var result = Tokenizer({
        insert: {
          title: 'Slaughterhouse Five'
        },
        into: 'books'
      });

      assert.deepEqual(result, [
        { type: 'IDENTIFIER', value: 'INSERT' },
        { type: 'KEY', value: 'title' },
        { type: 'VALUE', value: 'Slaughterhouse Five' },
        { type: 'ENDIDENTIFIER', value: 'INSERT' },
        { type: 'IDENTIFIER', value: 'INTO' },
        { type: 'VALUE', value: 'books' },
        { type: 'ENDIDENTIFIER', value: 'INTO' }
      ]);
    });
  });
});
