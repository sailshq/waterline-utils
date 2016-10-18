var Test = require('../../support/convert-runner');

describe('Converter :: ', function() {
  describe('Max :: ', function() {
    it('should generate a find query using the max modifier', function() {
      Test({
        criteria: {
          model: 'user',
          method: 'find',
          criteria: {
            where: {
              firstName: 'Test',
              lastName: 'User'
            },
            max: ['age']
          }
        },
        query: {
          max: 'age',
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
