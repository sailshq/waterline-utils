var Test = require('../../support/convert-runner');

describe('Converter :: ', function() {
  describe('Sum :: ', function() {
    it('should generate a find query using the sum modifier', function() {
      Test({
        criteria: {
          model: 'user',
          method: 'find',
          criteria: {
            where: {
              firstName: 'Test',
              lastName: 'User'
            },
            sum: 'age'
          }
        },
        query: {
          sum: 'age',
          from: 'user',
          where: {
            and: [
              {
                firstName: 'Test'
              },
              {
                lastName: 'User'
              }
            ]
          }
        }
      });
    });
  });
});
