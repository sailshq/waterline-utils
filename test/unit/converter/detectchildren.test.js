var Test = require('../../support/detectchildren-runner');

describe('Detect Children :: ', function () {
  it('should parse the child record correctly', function () {
    Test({
      primaryKeyAttr: 'childId',

      records: [{
        id: 1,
        childId: '2',
        'childId__id': '2',
        'childId__a1__c1': 'a1',
        'childId__a2__c1': 'a2'
      }],
      expected: {
        parents: [{
          id: 1,
          childId: '2'
        }],
        children: {
          childId: [{
            id: '2',
            'a1__c1': 'a1',
            'a2__c1': 'a2'
          }]
        }
      }
    });
  });
});
