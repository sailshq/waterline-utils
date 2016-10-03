var Analyzer = require('../../index').analyzer;
var tokenize = require('../support/tokenize');
var assert = require('assert');

describe('Analyzer ::', function() {
  describe('RETURNING statements', function() {
    it('should generate a valid group for RETURNING statements', function(done) {
      var tokens = tokenize({
        insert: {
          title: 'Slaughterhouse Five'
        },
        into: 'books',
        returning: 'author'
      });

      Analyzer({
        tokens: tokens
      })
      .exec(function(err, result) {
        assert(!err);

        assert.deepEqual(result, [
          [
            { type: 'IDENTIFIER', value: 'INSERT' },
            { type: 'KEY', value: 'title' },
            { type: 'VALUE', value: 'Slaughterhouse Five' }
          ],
          [
            { type: 'IDENTIFIER', value: 'INTO' },
            { type: 'VALUE', value: 'books' }
          ],
          [
            { type: 'IDENTIFIER', value: 'RETURNING' },
            { type: 'VALUE', value: 'author' }
          ]
        ]);

        return done();
      });
    });

    it('should generate a valid group for RETURNING statements when arrays are used', function(done) {
      var tokens = tokenize({
        insert: {
          title: 'Slaughterhouse Five'
        },
        into: 'books',
        returning: ['author', 'title']
      });

      Analyzer({
        tokens: tokens
      })
      .exec(function(err, result) {
        assert(!err);

        assert.deepEqual(result, [
          [
            { type: 'IDENTIFIER', value: 'INSERT' },
            { type: 'KEY', value: 'title' },
            { type: 'VALUE', value: 'Slaughterhouse Five' }
          ],
          [
            { type: 'IDENTIFIER', value: 'INTO' },
            { type: 'VALUE', value: 'books' }
          ],
          [
            { type: 'IDENTIFIER', value: 'RETURNING' },
            { type: 'VALUE', value: ['author', 'title'] }
          ]
        ]);

        return done();
      });
    });
  });
});
