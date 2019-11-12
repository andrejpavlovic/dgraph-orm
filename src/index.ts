import 'reflect-metadata';
import { Operation } from 'dgraph-js';

import debugWrapper from './utils/debug';
import { client } from './utils/client';
import { DgraphNode } from './types/dgraph_node';

import { Node } from './decorators/node';
import { Predicate } from './decorators/predicate';
import { Facet } from './decorators/facet';

import { NODE_STORAGE, PREDICATE_STORAGE, NODE_PREDICATE_MAPPING, getGlobalDgraphSchema } from './storage';
import { DgraphType } from './types/dgraph_types';

const debug = debugWrapper('index');

@Node()
class ConnectedNode extends DgraphNode {
  @Predicate()
  name: string;

  @Facet('connects')
  order?: number;
}

@Node()
class TestNode extends DgraphNode {
  @Predicate({
    type: DgraphType.String,
    isArray: true,
  })
  type: string[];

  @Predicate()
  enabled: boolean;

  @Predicate({
    type: ConnectedNode,
    isArray: true,
  })
  connects: ConnectedNode[];
}

debug('node storage:\n%O', NODE_STORAGE);
debug('predicate storage:\n%O', PREDICATE_STORAGE);
debug('node-predicate mapping:\n%O', NODE_PREDICATE_MAPPING);

const t = new TestNode();

debug(Reflect.getMetadata('dgraph:node', t.constructor));
debug(getGlobalDgraphSchema());

debug('pushing schema into dgraph');

const schemaOp = new Operation();
schemaOp.setSchema(getGlobalDgraphSchema());
client.alter(schemaOp).then(() => debug('done'));