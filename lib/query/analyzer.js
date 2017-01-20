//   █████╗ ███╗   ██╗ █████╗ ██╗  ██╗   ██╗███████╗███████╗██████╗
//  ██╔══██╗████╗  ██║██╔══██╗██║  ╚██╗ ██╔╝╚══███╔╝██╔════╝██╔══██╗
//  ███████║██╔██╗ ██║███████║██║   ╚████╔╝   ███╔╝ █████╗  ██████╔╝
//  ██╔══██║██║╚██╗██║██╔══██║██║    ╚██╔╝   ███╔╝  ██╔══╝  ██╔══██╗
//  ██║  ██║██║ ╚████║██║  ██║███████╗██║   ███████╗███████╗██║  ██║
//  ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚═╝   ╚══════╝╚══════╝╚═╝  ╚═╝
//
// Analyze a set of "tokens" and group them together based on functionality.
// Tokens come from the "Tokenizer" helper which is responsible for taking a
// deeply nested Waterline Statement and breaking it down into a flat list
// of keyed tokens that are easier to parse and work with.
//
// Once the tokens have been created the analyzer goes through and groups the
// tokens into discrete pieces of query logic. These groups are then used by
// other helpers such as the SQL builder or Mongo query builder to generate a
// native query. The point of the analyzer isn't to re-create the orignal nested
// statement but to group related pieces of the query that will be processed as
// chunks. So an OR clause will have each set in the clause grouped or a subquery
// will have it's contents grouped.
//
// In most cases this will not be implemented by adapter authors but will be used
// inside a database driver's `compileStatement` machine.

var _ = require('@sailshq/lodash');

module.exports = function analyzer(tokens) {
  if (!tokens) {
    throw new Error('Missing tokens argument.');
  }

  // Key/Value pair tokens
  var KEY_VALUE_TOKENS = ['KEY', 'VALUE', 'OPERATOR', 'COMBINATOR'];

  // Wrapped tokens
  var WRAPPED_TOKENS = [
    'JOIN',
    'INNERJOIN',
    'OUTERJOIN',
    'CROSSJOIN',
    'LEFTJOIN',
    'LEFTOUTERJOIN',
    'RIGHTJOIN',
    'RIGHTOUTERJOIN',
    'FULLOUTERJOIN'
  ];

  // Hold the results of the token processing as a giant nested array.
  var results = [];

  //  ╦ ╦╦═╗╦╔╦╗╔═╗  ╔═╗╦ ╦╦ ╦╔╗╔╦╔═
  //  ║║║╠╦╝║ ║ ║╣   ║  ╠═╣║ ║║║║╠╩╗
  //  ╚╩╝╩╚═╩ ╩ ╚═╝  ╚═╝╩ ╩╚═╝╝╚╝╩ ╩
  //
  // Given a chunk of data, write it to the result container
  var writeChunk = function writeChunk(chunk, wrappedChunk, write) {
    try {
      // Write the chunk
      if (write) {
        results.push(chunk);
      }
    } catch (e) {
      throw new Error('Error parsing chunk');
    }

    return chunk;
  };


  var analyzer = function analyzer(tokens) {
    // Hold the current chunk
    var chunk;

    // Hold a grouped nested chunk
    var nestedChunk;

    // Hold a focus element
    var focus;

    // Hold the current level of nesting
    var nestedLevel = 0;

    // Hold the flag for wrapping a chunk
    var wrappedChunk = false;

    // Hold the token array for unions
    var union = false;

    // Hold the flag array for wrapping a subquery
    var subquery = [];

    // Process the token list in order
    _.each(tokens, function analyzeToken(token) {
      //  ╦ ╦╔╗╔╦╔═╗╔╗╔
      //  ║ ║║║║║║ ║║║║
      //  ╚═╝╝╚╝╩╚═╝╝╚╝
      //
      // If the token is a union, toggle the flag and wrap with an array
      if (token.type === 'UNION') {
        union = true;
        chunk = [token, []];
        return;
      }

      // End a UNION section by toggling it off and writing the chunk
      if (token.type === 'ENDUNION') {
        union = false;
        writeChunk(chunk, false, true);
        return;
      }

      //  ╔═╗╦ ╦╔╗ ╔═╗ ╦ ╦╔═╗╦═╗╦ ╦
      //  ╚═╗║ ║╠╩╗║═╬╗║ ║║╣ ╠╦╝╚╦╝
      //  ╚═╝╚═╝╚═╝╚═╝╚╚═╝╚═╝╩╚═ ╩
      //
      // If the token is a subquery, flag it as such and open up a new group
      // on the chunk.
      if (token.type === 'SUBQUERY') {
        // Set a subquery level flag
        subquery.push(true);

        // Don't wrap subqueries inside UNION queries. These behave differently
        // than normal subqueries because they have a special processing function
        // in Knex.
        if (!union) {
          // If inside of a grouping set, push things to the grouped chunk rather
          // than the main chunk. This is used in OR queries for example to contain
          // a block of logic.
          if (nestedChunk) {
            (function processNonUnionNestedChunk() {
              // Treat arrays differently by pushing onto the last item.
              if (_.isArray(_.last(nestedChunk))) {
                var tokenItem = [token, []];
                focus = _.last(tokenItem);
                nestedChunk.push(tokenItem);
              } else {
                nestedChunk.push(token);
                nestedChunk.push([]);
                focus = _.last(nestedChunk);
              }
            })();

          // Otherwise just push the token onto the main chunk and start a new
          // group to hold the subquery logic.
          } else {
            chunk.push(token);
            chunk.push([]);
            focus = _.last(chunk);
          }
        }

        return;
      }

      // When the subquery is closed, remove the flag.
      if (token.type === 'ENDSUBQUERY') {
        subquery.pop();
        return;
      }

      //  ╦╔╦╗╔═╗╔╗╔╔╦╗╦╔═╗╦╔═╗╦═╗╔═╗
      //  ║ ║║║╣ ║║║ ║ ║╠╣ ║║╣ ╠╦╝╚═╗
      //  ╩═╩╝╚═╝╝╚╝ ╩ ╩╚  ╩╚═╝╩╚═╚═╝
      //
      // If the token is an identifier, write the current chunk and start a
      // new one.
      if (token.type === 'IDENTIFIER') {
        // Start a new chunk unless there is a subquery being built, in
        // which case continue appending logic.
        if (subquery.length) {
          if (nestedChunk) {
            // If inside a nested group, push the token to the focused item.
            (function handleNestedSubqueryIdentifiers() {
              var tokenItem = [token];
              focus.push(tokenItem);
              focus = tokenItem;
            })();
          } else {
            // Otherwise push the token to the last item of the chunk and focus
            // it.
            (function handleNonNestedSubqueryIdentifiers() {
              var tokenItem = [token];
              _.last(chunk).push(tokenItem);
              focus = tokenItem;
            })();
          }

        // If not in a sub-query, open a new chunk and add the token.
        } else {
          chunk = [];
          chunk.push(token);
        }

        // If this is a wrapped chunk, add an extra '['
        if (_.indexOf(WRAPPED_TOKENS, token.value) > -1) {
          wrappedChunk = true;

          if (nestedChunk) {
            _.last(nestedChunk).push([]);
            focus = _.last(_.last(nestedChunk));
          } else {
            chunk.push([]);
            focus = _.last(chunk);
          }
        }

        return;
      }

      // Close out an idetifier set
      if (token.type === 'ENDIDENTIFIER') {
        // The write flag determines if the clause is ready to be parsed and
        // written to the results. If we are inside a subquery it shouldn't
        // be written to the results until the end. It should be closed though.
        var write = subquery.length ? false : true;

        // Toggle the wrap off when ending the token set
        if (wrappedChunk) {
          wrappedChunk = false;
        }

        chunk = writeChunk(chunk, wrappedChunk, write);

        if (nestedChunk) {
          // UNION queries when grouped behave a bit different. Here just focus
          // the group using the nestedChunk
          if (union) {
            focus = nestedChunk;

          // In non-UNION queries, after an identifier the last item in the group
          // should be focused.
          } else {
            focus = _.last(nestedChunk);
          }

        // In non-grouped segments, ditch the focus because nothing should be
        // inside anything.
        } else {
          focus = undefined;
        }

        return;
      }

      //  ╦╔═╔═╗╦ ╦  ╦  ╦╔═╗╦  ╦ ╦╔═╗  ╔═╗╔═╗╦╦═╗╔═╗
      //  ╠╩╗║╣ ╚╦╝  ╚╗╔╝╠═╣║  ║ ║║╣   ╠═╝╠═╣║╠╦╝╚═╗
      //  ╩ ╩╚═╝ ╩    ╚╝ ╩ ╩╩═╝╚═╝╚═╝  ╩  ╩ ╩╩╩╚═╚═╝
      //
      // Handles simple key/value pairs for KEY/VALUE/OPERATOR tokens
      if (_.indexOf(KEY_VALUE_TOKENS, token.type) > -1) {
        (function processFocusedItem() {
          var piece = focus ? focus : chunk;
          piece.push(token);
        })();
        return;
      }

      //  ╔═╗╦═╗╔═╗╦ ╦╔═╗╦╔╗╔╔═╗
      //  ║ ╦╠╦╝║ ║║ ║╠═╝║║║║║ ╦
      //  ╚═╝╩╚═╚═╝╚═╝╩  ╩╝╚╝╚═╝

      // If this is a GROUP token, open a new grouping pair.
      if (token.type === 'GROUP') {
        // Bump the nested level
        nestedLevel += 1;

        (function startHandlingGroup() {
          // If not inside a nested chunk, open it up and focus it.
          if (!nestedChunk) {
            nestedChunk = [];
            focus = nestedChunk;
            return;
          }

          // Find the last item in the nested array
          var findFocus = function findFocus(arr, parentFocus) {
            // Otherwise this is a deeply nested chunk
            var last = _.last(arr);
            if (_.isArray(last)) {
              parentFocus = arr;
              return findFocus(last, parentFocus);
            }

            // Set the focus
            var parent = parentFocus || arr;

            if (!union) {
              // If there is no last item, push an array on and give it focus
              if (!last) {
                if (_.isArray(_.last(parent))) {
                  _.last(parent).push([]);
                  focus = _.last(_.last(parent));
                  return;
                }
              }

              // Check if the last item is an identitifier (such as WHERE). If so
              // then the focus should belong to it.
              if (last && last.type === 'IDENTIFIER') {
                _.last(parent).push([]);
                focus = _.last(_.last(parent));

              // Ensure AND conditions don't get prematurely closes
              } else if (last && last.type === 'CONDITION') {
                if (_.isArray(_.last(parent))) {
                  var lastSet = _.last(_.last(parent));
                  if (lastSet.type === 'CONDITION' && lastSet.value === 'AND') {
                    _.last(parent).push([]);
                    focus = _.last(_.last(parent));
                    return;
                  }
                }

                parent.push([]);
                focus = _.last(parent);

              // Otherwise add a new group to the parent and focus it.
              } else {
                parent.push([]);
                focus = _.last(parent);
              }

            // If inside a UNION, work with the nested array.
            } else {
              _.last(parent).push([]);
              focus = _.last(_.last(parent));
            }
          };

          // Kick off the find focus fn.
          findFocus(nestedChunk);
        })();

        return;
      }

      // Save the current group to the condition
      if (token.type === 'ENDGROUP') {
        // Decrement the nested level
        nestedLevel -= 1;

        (function handWritingGroupSet() {
          // If the focused item is equal to the nested chunk, it's done. Otherwise
          // traverse up a level.
          if (nestedLevel === 0) {
            // In a UNION query just add the nested piece to the last item in the
            // chunk.
            if (union) {
              _.last(chunk).push(nestedChunk);

            // Otherwise take a deep look and determine where to place it.
            } else {
              // If the chunk has a trailing array, inspect it to see if the
              // group needs to be written to it.
              if (_.isArray(_.last(chunk))) {
                // Start a deep-dive to see where the nesting needs to be set.
                if (_.isArray(_.last(_.last(chunk)))) {
                  // This is a bit trickier. Check what preceeds the value and see
                  // if this is trying to work with an AND clause.
                  (function doDeepCheck() {
                    var chunkLength = chunk.length;
                    var tokenType = chunk[chunkLength - 2];

                    // If the token type is a condition, process it accordingly
                    if (tokenType && tokenType.type === 'CONDITION') {
                      // AND tokens should just be appendend to the main chunk
                      if (tokenType.value === 'AND') {
                        chunk.push(nestedChunk);
                      }

                    // Identitifier's are also processed
                    } else if (tokenType && tokenType.type === 'IDENTIFIER') {
                      // WHERE tokens are also just appendend to the main chunk
                      if (tokenType.value === 'WHERE') {
                        chunk.push(nestedChunk);
                      }

                    // For everything else, deeply append it to the chunk
                    } else {
                      _.last(_.last(chunk)).push(nestedChunk);
                    }
                  })();

                // Otherwise just push onto the end of the chunk. The deep check
                // isn't needed.
                } else {
                  chunk.push(nestedChunk);
                }

              // If nothing is trailing, just push to the chunk.
              } else {
                chunk.push(nestedChunk);
              }
            }

            // Clear the nested chunk and the focus
            nestedChunk = undefined;
            focus = undefined;
          }
        })();
      }

      //  ╔═╗╔═╗╔╗╔╔╦╗╦╔╦╗╦╔═╗╔╗╔╔═╗
      //  ║  ║ ║║║║ ║║║ ║ ║║ ║║║║╚═╗
      //  ╚═╝╚═╝╝╚╝═╩╝╩ ╩ ╩╚═╝╝╚╝╚═╝
      //
      // Only some conditions are actually written out
      if (token.type === 'CONDITION' && _.indexOf(['NOT', 'IN', 'NOTIN', 'AND'], token.value) > -1) {
        (function addConditionUsingFocus() {
          var piece = focus ? focus : chunk;
          piece.push(token);
        })();
        return;
      }
    });
  };

  // Kick off the analyzer.
  analyzer(tokens);

  return results;
};
