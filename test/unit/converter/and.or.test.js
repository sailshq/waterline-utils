var Test = require('../../support/convert-runner');

describe('Converter ::', function() {
  describe('Mixing And with Or', function() {
    it('should generate a query', function() {
      Test({
        criteria: {
          model: 'user',
          method: 'find',
          criteria: {
            where: {
              type: 'athlete',
              or: [
                {
                  firstName: 'Micheal'
                },
                {
                  lastName: 'Jordan'
                }
              ]
            }
          }
        },
        query: {
          select: ['*'],
          from: 'user',
          where: {
            and: [
              {
                type: 'athlete'
              },
              {
                or: [
                  {
                    firstName: 'Micheal'
                  },
                  {
                    lastName: 'Jordan'
                  }
                ]
              }
            ]
          }
        }
      });
    });
  });
});
