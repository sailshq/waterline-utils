var runBenchmarks = require('../support/benchmark-runner');
var Tokenizer = require('../../index').tokenizer;

//  ╔╗ ╔═╗╔╗╔╔═╗╦ ╦╔╦╗╔═╗╦═╗╦╔═╔═╗
//  ╠╩╗║╣ ║║║║  ╠═╣║║║╠═╣╠╦╝╠╩╗╚═╗
//  ╚═╝╚═╝╝╚╝╚═╝╩ ╩╩ ╩╩ ╩╩╚═╩ ╩╚═╝
describe('Benchmark :: Tokenizer', function() {
  // Set "timeout" and "slow" thresholds incredibly high
  // to avoid running into issues.
  this.slow(240000);
  this.timeout(240000);

  it('should be performant enough', function(done) {
    runBenchmarks('Tokenizer.execSync()', [
      function buildSelectTokenSet(next) {
        Tokenizer({
          expression: {
            select: '*',
            from: 'books'
          }
        }).execSync();
        return next();
      },

      function buildInsertTokenSet(next) {
        Tokenizer({
          expression: {
            insert: {
              title: 'Slaughterhouse Five'
            },
            into: 'books'
          }
        }).execSync();
        return next();
      },

      function buildUpdateTokenSet(next) {
        Tokenizer({
          expression: {
            update: {
              status: 'archived'
            },
            where: {
              publishedDate: { '>': 2000 }
            },
            using: 'books'
          }
        }).execSync();
        return next();
      },

      function buildDeleteTokenSet(next) {
        Tokenizer({
          expression: {
            del: true,
            from: 'accounts',
            where: {
              activated: false
            }
          }
        }).execSync();
        return next();
      }
    ], done);
  });
});
