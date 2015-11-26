/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @emails oncall+relay
 */

'use strict';

var RelayTestUtils = require('RelayTestUtils');
RelayTestUtils.unmockRelay();

jest
  .dontMock('GraphQLRange')
  .dontMock('GraphQLSegment')
  .mock('warning');

var Relay = require('Relay');

describe('writeRelayQueryPayload()', () => {
  var RelayRecordStore;

  var {
    getNode,
    getRefNode,
    getVerbatimNode,
    writePayload,
    writeVerbatimPayload
  } = RelayTestUtils;

  beforeEach(() => {
    jest.resetModuleRegistry();

    RelayRecordStore = require('RelayRecordStore');

    jest.addMatchers(RelayTestUtils.matchers);
  });

  describe('root record', () => {

    it('is created for argument-less custom root calls with an id', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          me {
            id,
          }
        }
      `);
      var payload = {
        me: {
          id: '123',
        },
      };
      var results = writePayload(store, query, payload);
      expect(results).toEqual({
        created: {
          123: true,
        },
        updated: {},
      });
      expect(store.getRecordState('123')).toBe('EXISTENT');
      expect(store.getField('123', 'id')).toBe('123');
      expect(store.getDataID('me')).toBe('123');
    });

    it('is created for argument-less custom root calls without an id', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          viewer {
            actor {
              id,
            },
          }
        }
      `);
      var payload = {
        viewer: {
          actor: {
            id: '123',
          },
        },
      };
      var results = writePayload(store, query, payload);
      expect(results).toEqual({
        created: {
          'client:1': true,
          '123': true,
        },
        updated: {},
      });
      expect(store.getRecordState('client:1')).toBe('EXISTENT');
      expect(store.getLinkedRecordID('client:1', 'actor')).toBe('123');
      expect(store.getDataID('viewer')).toBe('client:1');
    });

    it('uses existing id for custom root calls without an id', () => {
      const cachedRootCallMap = {
        'viewer': {'': 'client:12345'},
      };
      const cachedRecords = {
        'client:12345': {__dataID__: 'client:12345'},
      };
      const rootCallMap = {};
      const records = {};
      const store = new RelayRecordStore(
        {records, cachedRecords},
        {cachedRootCallMap, rootCallMap}
      );
      const query = getNode(Relay.QL`
        query {
          viewer {
            actor {
              id,
            },
          }
        }
      `);
      const payload = {
        viewer: {
          actor: {
            id: '123',
          },
        },
      };
      const results = writePayload(store, query, payload);
      expect(results).toEqual({
        created: {
          '123': true,
        },
        updated: {
          'client:12345': true,
        },
      });
      expect(store.getRecordState('client:12345')).toBe('EXISTENT');
      expect(store.getLinkedRecordID('client:12345', 'actor')).toBe('123');
      expect(store.getDataID('viewer')).toBe('client:12345');
    });

    it('is created for custom root calls with an id', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          username(name:"yuzhi") {
            id,
          }
        }
      `);
      var payload = {
        username: {
          id: '1055790163',
        },
      };
      var results = writePayload(store, query, payload);
      expect(results).toEqual({
        created: {
          '1055790163': true,
        },
        updated: {},
      });
      expect(store.getRecordState('1055790163')).toBe('EXISTENT');
      expect(store.getField('1055790163', 'id')).toBe('1055790163');
      expect(store.getDataID('username', 'yuzhi')).toBe('1055790163');
    });

    it('is created for custom root calls without an id', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      // note: this test simulates an `id`-less root call
      var query = getNode(Relay.QL`
        query {
          username(name:"yuzhi") {
            name,
          }
        }
      `);
      // remove the autogenerated `id` field
      query = query.clone(query.getChildren().slice(0, 1));
      // no `id` value is present, so the root ID is autogenerated
      var payload = {
        username: {
          name: 'Yuzhi Zheng',
        },
      };
      var results = writePayload(store, query, payload);
      expect(results).toEqual({
        created: {
          'client:1': true,
        },
        updated: {},
      });
      expect(store.getRecordState('client:1')).toBe('EXISTENT');
      expect(store.getField('client:1', 'name')).toBe('Yuzhi Zheng');
      expect(store.getDataID('username', 'yuzhi')).toBe('client:1');
    });

    it('is created for custom root calls with batch call variables', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      var query = getRefNode(Relay.QL`
        query {
          nodes(ids:$ref_q0) {
            id
          }
        }
      `, {path: '$.*.id'}); // This path is bogus.
      var payload = {
        nodes: [
          {
            id: '123',
          },
        ],
      };
      var results = writePayload(store, query, payload);
      expect(results).toEqual({
        created: {
          '123': true,
        },
        updated: {},
      });
      expect(store.getRecordState('123')).toBe('EXISTENT');
      expect(store.getField('123', 'id')).toBe('123');
    });

    it('requires arguments to `node()` root calls', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          node {
            id
          }
        }
      `);
      var payload = {
        node: null,
      };
      expect(() => {
        writePayload(store, query, payload);
      }).toFailInvariant(
        'RelayRecordStore.getDataID(): Argument to `node()` cannot be ' +
        'null or undefined.'
      );
    });

    it('is created and set to null when the response is null', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          node(id:"123") {
            id
          }
        }
      `);
      var payload = {
        node: null,
      };
      var results = writePayload(store, query, payload);
      expect(results).toEqual({
        created: {},
        updated: {},
      });
      expect(store.getRecordState('123')).toBe('NONEXISTENT');
    });

    it('is deleted when a response returns null', () => {
      var records = {
        '123': {
          __dataID__: '123',
          id: '123'
        }
      };
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          node(id:"123") {
            id
          }
        }
      `);
      var payload = {
        node: null,
      };
      var results = writePayload(store, query, payload);
      expect(results).toEqual({
        created: {},
        updated: {
          '123': true,
        },
      });
      expect(store.getRecordState('123')).toBe('NONEXISTENT');
    });

    it('requires an array if root args is an array', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          nodes(ids:["123", "456"]) {
            id
          }
        }
      `);
      var payload = {
        me: {
          __dataID__: '123',
          id: '123',
        },
      };
      expect(() => {
        writePayload(store, query, payload);
      }).toFailInvariant(
        'RelayOSSNodeInterface: Expected payload for root field `nodes` to ' +
        'be an array with 2 results, instead received a single non-array ' +
        'result.'
      );
    });

    it('requires a single result if root args is a single value', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          me {
            id
          }
        }
      `);
      var payload = {
        me: [
          {
            __dataID__: '123',
            id: '123',
          },
          {
            __dataID__: '456',
            id: '456',
          },
        ],
      };
      expect(() => {
        writePayload(store, query, payload);
      }).toFailInvariant(
        'RelayOSSNodeInterface: Expected payload for root field `me` to be a ' +
        'single non-array result, instead received an array with 2 results.'
      );
    });

    it('handles plural results for ref queries', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      var query = getRefNode(Relay.QL`
        query {
          nodes(ids:$ref_q0) {
            id,
            name
          }
        }
      `, {path: '$.*.id'}); // This path is bogus.
      var payload = {
        nodes: [
          {
            __dataID__: '123',
            id: '123',
            name: 'Yuzhi',
          },
          {
            __dataID__: '456',
            id: '456',
            name: 'Jing',
          },
        ],
      };
      writePayload(store, query, payload);
      expect(store.getRecordState('123')).toBe('EXISTENT');
      expect(store.getField('123', 'name')).toBe('Yuzhi');
      expect(store.getRecordState('456')).toBe('EXISTENT');
      expect(store.getField('456', 'name')).toBe('Jing');
    });

    it('is not created when the response is undefined', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          node(id:"123") {
            id
          }
        }
      `);
      var payload = {
        node: undefined,
      };
      expect(() => {
        writePayload(store, query, payload);
      }).toFailInvariant(
        'RelayQueryWriter: Unexpectedly encountered `undefined` in payload. ' +
        'Cannot set root record `123` to undefined.'
      );
      expect(store.getRecordState('123')).toBe('UNKNOWN');
    });

    it('is not deleted when the response is undefined', () => {
      var records = {
        '123': {
          __dataID__: '123',
          id: '123'
        }
      };
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          node(id:"123") {
            actor {
              id
            }
          }
        }
      `);
      var payload = {
        node: undefined,
      };
      expect(() => {
        writePayload(store, query, payload);
      }).toFailInvariant(
        'RelayQueryWriter: Unexpectedly encountered `undefined` in payload. ' +
        'Cannot set root record `123` to undefined.'
      );
      expect(store.getRecordState('123')).toBe('EXISTENT');
    });

    it('is created when a new record returns a value', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          node(id:"123") {
            id
          }
        }
      `);
      var payload = {
        node: {
          id: '123'
        },
      };
      var results = writePayload(store, query, payload);
      expect(results).toEqual({
        created: {
          '123': true
        },
        updated: {},
      });
      expect(store.getRecordState('123')).toBe('EXISTENT');
    });

    it('is not updated if the record exists and has no changes', () => {
      var records = {
        '123': {
          __dataID__: '123',
          id: '123',
        },
      };
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          node(id:"123") {
            id
          }
        }
      `);
      var payload = {
        node: {
          id: '123'
        },
      };
      var results = writePayload(store, query, payload);
      expect(results).toEqual({
        created: {},
        updated: {},
      });
      expect(store.getRecordState('123')).toBe('EXISTENT');
    });

    it('is updated if the record has changes', () => {
      var records = {
        '123': {
          __dataID__: '123',
          id: '123',
          name: 'Joe'
        },
      };
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          node(id:"123") {
            id,
            name
          }
        }
      `);
      var payload = {
        node: {
          id: '123',
          name: 'Joseph'
        },
      };
      var results = writePayload(store, query, payload);
      expect(results).toEqual({
        created: {},
        updated: {
          '123': true,
        },
      });
      expect(store.getRecordState('123')).toBe('EXISTENT');
      expect(store.getField('123', 'name')).toBe('Joseph');
    });

    it('is not affected by non-requested fields', () => {
      var records = {
        '123': {
          __dataID__: '123',
          id: '123',
        },
      };
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          node(id:"123") {
            id,
          }
        }
      `);
      var payload = {
        node: {
          id: '123',
          name: 'Joseph'
        },
      };
      var results = writePayload(store, query, payload);
      expect(results).toEqual({
        created: {},
        updated: {},
      });
      expect(store.getRecordState('123')).toBe('EXISTENT');
      expect(store.getField('123', 'name')).toBe(undefined);
    });

    it('records the concrete type if `__typename` is present', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      var query = getNode(Relay.QL`
        query {
          node(id: "123") {
            id,
            __typename
          }
        }
      `);
      var payload = {
        node: {
          id: '123',
          __typename: 'User',
          foo: 'bar',
        },
      };
      writePayload(store, query, payload);
      expect(store.getType('123')).toBe('User');
    });

    it('records the parent field type if `__typename` is not present', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      var query = getVerbatimNode(Relay.QL`
        query {
          node(id: "123") {
            id
          }
        }
      `);
      var payload = {
        node: {
          id: '123',
        },
      };
      writePayload(store, query, payload);
      // `Node` is the type of the `id` field's parent (`node(...): Node`)
      expect(store.getType('123')).toBe('Node');
    });

    it('warns if the typename cannot be determined for a node', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      // No `id` or `__typename` fields
      var query = getVerbatimNode(Relay.QL`
        query {
          node(id: "123") {
            name
          }
        }
      `);
      // But the payload contains an `id` so the writer will attempt to store a
      // `__typename`.
      var payload = {
        node: {
          id: '123',
          name: 'Joe',
        },
      };
      writeVerbatimPayload(store, query, payload);
      expect(store.getType('123')).toBe(null);
      expect([
        'RelayQueryWriter: Could not find a type name for record `%s`.',
        '123'
      ]).toBeWarnedNTimes(1);
    });

    it('does not store types for client records', () => {
      var records = {};
      var store = new RelayRecordStore({records});
      // No `id` or `__typename` fields
      var query = getVerbatimNode(Relay.QL`
        query {
          viewer {
            actor {
              name
            }
          }
        }
      `);
      // No `id` value - treated as a client record
      var payload = {
        viewer: {
          actor: {
            name: 'Joe',
          },
        },
      };
      writePayload(store, query, payload);
      expect(store.getType('client:1')).toBe(null);
    });
  });
});
