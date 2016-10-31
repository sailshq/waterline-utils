var Test = require('../../support/convert-runner');

describe('Converter :: ', function() {
  describe('Min :: ', function() {
    it('should generate a find query using the min modifier', function() {
      Test({
        criteria: {
          model: 'user',
          method: 'find',
          criteria: {
            where: {
              firstName: 'Test',
              lastName: 'User'
            },
            min: 'age'
          }
        },
        query: {
          min: 'age',
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
