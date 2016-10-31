var Test = require('../../support/convert-runner');

describe('Converter :: ', function() {
  describe('Averages :: ', function() {
    it('should generate a find query using the average modifier', function() {
      Test({
        criteria: {
          model: 'user',
          method: 'find',
          criteria: {
            where: {
              firstName: 'Test',
              lastName: 'User'
            },
            average: 'age'
          }
        },
        query: {
          avg: 'age',
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
