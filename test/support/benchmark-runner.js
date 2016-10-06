var _ = require('lodash');
var Benchmark = require('benchmark');

module.exports = function runBenchmarks(name, testFns, done) {
  var suite = new Benchmark.Suite({
    name: name
  });

  _.each(testFns, function buildTest(testFn) {
    suite = suite.add(testFn.name, {
      defer: true,
      fn: function fn(deferred) {
        testFn(function _afterRunningTestFn(err) {
          if (err) {
            console.error('An error occured when attempting to benchmark this code:\n', err);
            // Resolve the deferred either way.
          }

          deferred.resolve();
        }); // </afterwards cb from running test fn>
      }
    });// <suite.add>
  });// </each testFn>

  suite.on('cycle', function(event) {
    console.log(' •', String(event.target));
  })
  .on('complete', function() {
    // Time is measured in microseconds so 10000 =
    var fastestMean = _.first(this.filter('fastest')).stats.mean * 1000;
    var slowestMean = _.first(this.filter('slowest')).stats.mean * 1000;

    var mean = {
      fastest: Benchmark.formatNumber(fastestMean < 1 ? fastestMean.toFixed(2) : Math.round(fastestMean)),
      slowest: Benchmark.formatNumber(slowestMean < 1 ? slowestMean.toFixed(2) : Math.round(slowestMean))
    };

    console.log('Fastest is ' + this.filter('fastest').map('name') + ' with an average of: ' + mean.fastest + 'ms');
    console.log('Slowest is ' + this.filter('slowest').map('name') + ' with an average of: ' + mean.slowest + 'ms');

    return done(undefined, this);
  })
  .run();
};
