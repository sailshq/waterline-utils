var assert = require('assert');
var DetectChildren = require('../../lib/joins/detect-children-records');

module.exports = function(test) {
  var result = DetectChildren(test.primaryKeyAttr, test.records);
  assert.deepEqual(result, test.expected);
};
