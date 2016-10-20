var Test = require('../../support/convert-runner');

describe('Converter :: ', function() {
  describe('Using Cursor Instructions (for single query situations) :: ', function() {
    describe('With Strategy 1 :: ', function() {
      it('should generate a find query with a left outer join', function() {
        Test({
          criteria: {
            model: 'user',
            method: 'find',
            criteria: {
              // Parent Criteria
              where: {
                type: 'beta user'
              },
              sort: [
                {
                  amount: 'DESC'
                }
              ],
              // Join Instructions
              instructions: {
                pet: {
                  strategy: {
                    strategy: 1,
                    meta: {
                      parentFK: 'pet_id'
                    }
                  },
                  instructions: [
                    {
                      parent: 'user',
                      parentKey: 'pet_id',
                      child: 'pet',
                      childKey: 'id',
                      alias: 'pet',
                      removeParentKey: true,
                      model: true,
                      collection: false,
                      select: ['id', 'name', 'breed'],
                      criteria: {}
                    }
                  ]
                }
              }
            }
          },
          query: {
            select: ['pet.id', 'pet.name', 'pet.breed'],
            from: 'user',
            orderBy: [
              {
                amount: 'DESC'
              }
            ],
            where: {
              and: [
                {
                  type: 'beta user'
                }
              ]
            },
            leftOuterJoin: [
              {
                from: 'pet',
                on: {
                  user: 'pet_id',
                  pet: 'id'
                }
              }
            ]
          }
        });
      });
    });

    describe('With Strategy 2 :: ', function() {
      it('should generate a find query with a left outer join', function() {
        Test({
          criteria: {
            model: 'user',
            method: 'find',
            criteria: {
              // Parent Criteria
              where: {
                type: 'beta user'
              },
              sort: [
                {
                  amount: 'DESC'
                }
              ],
              // Join Instructions
              instructions: {
                pets: {
                  strategy: {
                    strategy: 2,
                    meta: {
                      childFK: 'user_id'
                    }
                  },
                  instructions: [
                    {
                      parent: 'user',
                      parentKey: 'id',
                      child: 'pet',
                      childKey: 'user_id',
                      alias: 'pets',
                      removeParentKey: true,
                      model: false,
                      collection: true,
                      select: ['id', 'name', 'breed', 'user_id'],
                      criteria: {}
                    }
                  ]
                }
              }
            }
          },
          query: {
            select: ['pet.id', 'pet.name', 'pet.breed', 'pet.user_id'],
            from: 'user',
            orderBy: [
              {
                amount: 'DESC'
              }
            ],
            where: {
              and: [
                {
                  type: 'beta user'
                }
              ]
            },
            leftOuterJoin: [
              {
                from: 'pet',
                on: {
                  user: 'id',
                  pet: 'user_id'
                }
              }
            ]
          }
        });
      });
    });

    describe('With Strategy 3 :: ', function() {
      it('should generate a find query with a two left outer join clauses', function() {
        Test({
          criteria: {
            model: 'user',
            method: 'find',
            criteria: {
              // Parent Criteria
              where: {
                type: 'beta user'
              },
              sort: [
                {
                  amount: 'DESC'
                }
              ],
              // Join Instructions
              instructions: {
                pets: {
                  strategy: {
                    strategy: 3,
                    meta: {
                      junctorIdentity: 'user_pets__pets_users',
                      junctorPK: 'id',
                      junctorFKToParent: 'user_pets',
                      junctorFKToChild: 'pet_users'
                    }
                  },
                  instructions: [
                    {
                      parent: 'user',
                      parentKey: 'id',
                      child: 'user_pets__pets_users',
                      childKey: 'user_pets',
                      alias: 'pets',
                      removeParentKey: false,
                      model: false,
                      collection: true
                    },
                    {
                      parent: 'user_pets__pets_users',
                      parentKey: 'pet_users',
                      child: 'pet',
                      childKey: 'id',
                      alias: 'pets',
                      removeParentKey: false,
                      model: false,
                      collection: true,
                      select: ['id', 'name', 'breed'],
                      criteria: {}
                    }
                  ]
                }
              }
            }
          },
          query: {
            select: ['pet.id', 'pet.name', 'pet.breed'],
            from: 'user',
            orderBy: [
              {
                amount: 'DESC'
              }
            ],
            where: {
              and: [
                {
                  type: 'beta user'
                }
              ]
            },
            leftOuterJoin: [
              {
                from: 'user_pets__pets_users',
                on: {
                  user: 'id',
                  'user_pets__pets_users': 'user_pets'
                }
              },
              {
                from: 'pet',
                on: {
                  pet: 'id',
                  'user_pets__pets_users': 'pet_users'
                }
              }
            ]
          }
        });
      });
    });
  });
});
