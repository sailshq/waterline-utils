var runBenchmarks = require('../support/benchmark-runner');
var Tokenizer = require('../../index').tokenizer;
var Analyzer = require('../../index').analyzer;

//  ╔╗ ╔═╗╔╗╔╔═╗╦ ╦╔╦╗╔═╗╦═╗╦╔═╔═╗
//  ╠╩╗║╣ ║║║║  ╠═╣║║║╠═╣╠╦╝╠╩╗╚═╗
//  ╚═╝╚═╝╝╚╝╚═╝╩ ╩╩ ╩╩ ╩╩╚═╩ ╩╚═╝
describe('Benchmark :: Analyzer', function() {
  // Set "timeout" and "slow" thresholds incredibly high
  // to avoid running into issues.
  this.slow(240000);
  this.timeout(240000);

  var tokens = {};

  // Tokenize all the test inputs before running benchmarks
  before(function() {
    tokens.select = Tokenizer({
      expression: {
        select: '*',
        from: 'books'
      }
    }).execSync();

    tokens.insert = Tokenizer({
      expression: {
        insert: {
          title: 'Slaughterhouse Five'
        },
        into: 'books'
      }
    }).execSync();

    tokens.update = Tokenizer({
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

    tokens.delete = Tokenizer({
      expression: {
        del: true,
        from: 'accounts',
        where: {
          activated: false
        }
      }
    }).execSync();
  });

  it('should be performant enough', function(done) {
    runBenchmarks('Analyzer.execSync()', [
      function analyzeSelectSet(next) {
        Analyzer({
          tokens: tokens.select
        }).execSync();
        return next();
      },

      function analyzeInsertSet(next) {
        Analyzer({
          tokens: tokens.insert
        }).execSync();
        return next();
      },

      function analyzeUpdateSet(next) {
        Analyzer({
          tokens: tokens.update
        }).execSync();
        return next();
      },

      function analyzeDeleteSet(next) {
        Analyzer({
          tokens: tokens.delete
        }).execSync();
        return next();
      }
    ], done);
  });
});