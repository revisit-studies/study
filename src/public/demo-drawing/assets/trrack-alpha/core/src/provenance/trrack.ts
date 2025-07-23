/* eslint-disable @typescript-eslint/no-explicit-any */
import { PayloadAction } from '@reduxjs/toolkit';
import {
  applyPatch, compare, deepClone, Operation,
} from 'fast-json-patch';
import { only } from 'node:test';
import { RecordActionArgs, Trrack } from './types';

import { initEventManager } from '../event';
import {
  createStateNode,
  CurrentChangeHandler,
  initializeProvenanceGraph,
  isRootNode,
  isStateNode,
  Metadata,
  NodeId,
  Nodes,
  ProvenanceNode,
  StateLike,
  StateNode,
  UnsubscribeCurrentChangeListener,
} from '../graph';
import { ProvenanceGraph } from '../graph/graph-slice';
import {
  ProduceWrappedStateChangeFunction,
  TrrackActionFunction,
} from '../registry';
import { ConfigureTrrackOptions } from './trrack-config-opts';
import { TrrackEvents } from './trrack-events';

const DEFAULT_UPDATES_BEFORE_CHECKPOINT = 25;

function getState<State, Event extends string>(
  node: ProvenanceNode<State, Event>,
  nodes: Nodes<State, Event>,
): State {
  const stateLike = node.state;
  if (stateLike.type === 'checkpoint') return stateLike.val;

  const { checkpointRef } = stateLike;
  const checkpointNode = nodes[checkpointRef];
  const path = getPath(checkpointNode, node, nodes);
  path.shift();
  const patches = path
    .map((p) => nodes[p])
    .map((n) => n.state.val as Operation[])
    .reduce((acc, patch) => [...acc, ...patch], []);

  const checkpointState = getState(checkpointNode, nodes);

  const results = applyPatch(
    checkpointState,
    deepClone(patches),
    true,
    false,
  );

  return results.newDocument;
}

function determineSaveStrategy<T>(
  trrackGraph: Nodes<T, any>,
  node: ProvenanceNode<T, any>,
  updatesBeforeCheckpoint: number,
): 'checkpoint' | 'patch' {
  let saveAsCheckpoint = true;
  let currentNode = node;
  for (let i = 0; i < updatesBeforeCheckpoint; i++) {
    if (
      currentNode.state.type === 'checkpoint'
            || isRootNode(currentNode)
    ) {
      saveAsCheckpoint = false;
      break;
    }
    currentNode = trrackGraph[currentNode.parent];
  }

  return saveAsCheckpoint ? 'checkpoint' : 'patch';
}

export function initializeTrrack<State = any, Event extends string = string>({
  registry,
  initialState,
  options,
}: ConfigureTrrackOptions<State, Event>): Trrack<State, Event> {
  let isTraversing = false;
  const eventManager = initEventManager();
  const graph = initializeProvenanceGraph<State, Event>(initialState);

  function getNode(id: NodeId) {
    return graph.backend.nodes[id];
  }

  eventManager.listen(TrrackEvents.TRAVERSAL_START, () => {
    isTraversing = true;
  });

  eventManager.listen(TrrackEvents.TRAVERSAL_END, () => {
    isTraversing = false;
  });

  const metadata = {
    add(
      metadata: Record<string, unknown>,
      node: NodeId = graph.current.id,
    ) {
      graph.update(
        graph.addMetadata({
          id: node,
          meta: metadata,
        }),
      );
    },
    latestOfType<T = unknown>(
      type: string,
      node: NodeId = graph.current.id,
    ) {
      return graph.backend.nodes[node].meta[type]?.at(-1) as
                | Metadata<T>
                | undefined;
    },
    allOfType<T = unknown>(type: string, node: NodeId = graph.current.id) {
      return graph.backend.nodes[node].meta[type] as
                | Metadata<T>[]
                | undefined;
    },
    latest(node: NodeId = graph.current.id) {
      const metas = graph.backend.nodes[node].meta;

      const latest = Object.keys(metas).reduce(
        (acc: Record<string, Metadata>, key: string) => {
          const data = metas[key].at(-1);
          if (data) acc[key] = data;
          return acc;
        },
        {},
      );

      return Object.keys(latest).length > 0 ? latest : undefined;
    },
    all(node: NodeId = graph.current.id) {
      return graph.backend.nodes[node].meta;
    },
    types(node: NodeId = graph.current.id) {
      return Object.keys(graph.backend.nodes[node].meta);
    },
  };

  const artifact = {
    add(artifact: unknown, node: NodeId = graph.current.id) {
      graph.update(
        graph.addArtifact({
          id: node,
          artifact,
        }),
      );
    },
    latest(node: NodeId = graph.current.id) {
      return graph.backend.nodes[node].artifacts.at(-1);
    },
    all(node: NodeId = graph.current.id) {
      return graph.backend.nodes[node].artifacts;
    },
  };
  const annotations = {
    add(annotation: string, node: NodeId = graph.current.id) {
      metadata.add({ annotation }, node);
    },
    latest(node: NodeId = graph.current.id) {
      return metadata.latestOfType<string>('annotation', node)?.val;
    },
    all(node: NodeId = graph.current.id) {
      return metadata
        .allOfType<string>('annotation', node)
        ?.map((a) => a.val) as string[] | undefined;
    },
  };
  const bookmarks = {
    add(node: NodeId = graph.current.id) {
      metadata.add({ bookmark: true }, node);
    },
    remove(node: NodeId = graph.current.id) {
      metadata.add({ bookmark: false }, node);
    },
    is(node: NodeId = graph.current.id) {
      return Boolean(
        metadata.latestOfType<boolean>('bookmark', node)?.val,
      );
    },
    toggle(node: NodeId = graph.current.id) {
      if (bookmarks.is(node)) bookmarks.remove(node);
      else bookmarks.add(node);
    },
  };

  return {
    registry,
    get isTraversing() {
      return isTraversing;
    },
    getState(node: ProvenanceNode<State, Event> = graph.current) {
      return getState(node, graph.backend.nodes);
    },
    graph,
    get current() {
      return graph.current;
    },
    get root() {
      return graph.root;
    },
    record({
      label,
      state,
      sideEffects,
      eventType: event,
      isEphemeral,
      makeCheckpoint,
      onlySideEffects = false,
    }: RecordActionArgs<State, Event>) {
      let newStateNode: StateNode<State, Event> | null = null;

      let stateToSave: StateLike<State> | null = null;

      const originalState = getState(
        this.current,
        this.graph.backend.nodes,
      );

      if (!onlySideEffects) {
        const patches = compare(originalState as any, state as any);

        const saveStrategy = makeCheckpoint
          ? 'checkpoint'
          : determineSaveStrategy(
            this.graph.backend.nodes,
            this.current,
            options?.updatesBeforeCheckpoint
                              || DEFAULT_UPDATES_BEFORE_CHECKPOINT,
          );

        if (saveStrategy === 'checkpoint') {
          stateToSave = {
            type: 'checkpoint',
            val: state,
          };
        } else {
          const lastRef = this.current.state.type === 'checkpoint'
            ? this.current.id
            : this.current.state.checkpointRef;

          stateToSave = {
            type: 'patch',
            val: patches,
            checkpointRef: lastRef,
          };
        }
      } else {
        stateToSave = {
          type: 'checkpoint',
          val: state,
        };
      }
      if (!stateToSave) {
        throw new Error(
          `Could not calculate new state. Previous state is: ${JSON.stringify(
            this.current.state,
            null,
            2,
          )}`,
        );
      }

      newStateNode = createStateNode({
        label,
        state: stateToSave,
        parent: this.current,
        sideEffects,
        isEphemeral,
        event,
      });

      if (!newStateNode) throw new Error('State Node creation failed!');

      graph.update(graph.addNode(newStateNode));
    },
    async apply<T extends string, Payload = any>(
      label: string,
      act: PayloadAction<Payload, T>,
      options?: {
                isEphemeral?: boolean;
                makeCheckpoint?: boolean;
            },
    ) {
      const isEphemeral = options?.isEphemeral || false;
      const makeCheckpoint = options?.makeCheckpoint || false;

      const action = registry.get(act.type);
      const originalState = getState(
        this.current,
        this.graph.backend.nodes,
      );

      if (action.config.hasSideEffects) {
        const { do: doAct = act, undo } = (
                    action.func as TrrackActionFunction<any, any, any, any>
        )(act.payload);

        this.record({
          label,
          state: originalState,
          isEphemeral,
          makeCheckpoint,
          sideEffects: { do: [doAct], undo: [undo] },
          eventType: action.config.eventType as Event,
        });
      } else {
        const newState = (
                    action.func as ProduceWrappedStateChangeFunction<State>
        )(originalState, act.payload);

        this.record({
          label,
          state: newState,
          isEphemeral,
          makeCheckpoint,
          sideEffects: { do: [], undo: [] },
          eventType: action.config.eventType as Event,
        });
      }
    },
    async to(node: NodeId) {
      eventManager.fire(TrrackEvents.TRAVERSAL_START);

      const path = getPath(
        graph.current,
        graph.backend.nodes[node],
        graph.backend.nodes,
      );

      const sideEffectsToApply: Array<PayloadAction<any, any>> = [];

      for (let i = 0; i < path.length - 1; ++i) {
        const currentNode = getNode(path[i]);
        const nextNode = getNode(path[i + 1]);

        const isUndo = isNextNodeUp(currentNode, nextNode);

        if (isUndo) {
          if (isStateNode(currentNode)) {
            sideEffectsToApply.push(
              ...currentNode.sideEffects.undo,
            );
          }
        } else if (isStateNode(nextNode)) sideEffectsToApply.push(...nextNode.sideEffects.do);
      }

      for (const sf of sideEffectsToApply) {
        const actionFunction = registry.get(sf.type)
          .func as TrrackActionFunction<any, any, any, any>;
        await actionFunction(sf.payload);
      }

      graph.update(graph.changeCurrent(node));

      eventManager.fire(TrrackEvents.TRAVERSAL_END);
    },
    undo() {
      const { current } = graph;

      if (isStateNode(current)) {
        let parent = graph.backend.nodes[current.parent];

        while (isStateNode(parent) && parent.isEphemeral) {
          parent = graph.backend.nodes[parent.parent];
        }

        return this.to(parent.id);
      }
      return Promise.resolve(console.warn('Already at root!'));
    },
    redo(to: 'latest' | 'oldest' = 'latest') {
      const { current } = graph;
      if (current.children.length > 0) {
        let child = graph.backend.nodes[
          current.children[
            to === 'oldest' ? 0 : current.children.length - 1
          ]
        ];

        while (
          isStateNode(child)
                    && child.isEphemeral
                    && child.children.length > 0
        ) {
          child = graph.backend.nodes[
            child.children[
              to === 'oldest'
                ? 0
                : current.children.length - 1
            ]
          ];
        }

        if (child.children.length > 0) {
          return this.to(child.id);
        }

        return Promise.resolve(
          console.warn('Already at latest in this branch!'),
        );
      }
      return Promise.resolve(
        console.warn('Already at latest in this branch!'),
      );
    },
    currentChange(
      listener: CurrentChangeHandler,
      skipOnNew = false,
    ): UnsubscribeCurrentChangeListener {
      return graph.currentChange(listener, {
        skipOnNew,
      });
    },
    done() {
      console.log('Setup later for URL sharing.');
    },
    tree() {
      return getTreeFromNode(graph.root, graph.backend.nodes);
    },
    on(event: TrrackEvents, listener: (args?: any) => void) {
      eventManager.listen(event, listener);
    },
    export() {
      return JSON.stringify(graph.backend);
    },
    exportObject() {
      return JSON.parse(
        JSON.stringify(graph.backend),
      ) as typeof graph.backend;
    },
    import(graphString: string) {
      const g: ProvenanceGraph<State, Event> = JSON.parse(graphString);

      const { current } = g;
      g.current = g.root;
      graph.update(graph.load(g));
      this.to(current);
    },
    importObject(g: typeof graph.backend) {
      const { current } = g;
      g.current = g.root;
      graph.update(graph.load(g));
      this.to(current);
    },
    metadata,
    artifact,
    annotations,
    bookmarks,
  };
}

function LCA<S>(
  current: ProvenanceNode<S, any>,
  destination: ProvenanceNode<S, any>,
  nodes: Nodes<S, any>,
): NodeId {
  let [source, target] = [current, destination];

  if (source.level > target.level) {
    [source, target] = [target, source];
  }

  let diff = target.level - source.level;

  while (isStateNode(target) && diff !== 0) {
    target = nodes[target.parent];
    diff -= 1;
  }

  if (source.id === target.id) return source.id;

  while (source.id !== target.id) {
    if (isStateNode(source)) source = nodes[source.parent];
    if (isStateNode(target)) target = nodes[target.parent];
  }

  return source.id;
}

function getPath<S>(
  current: ProvenanceNode<S, any>,
  destination: ProvenanceNode<S, any>,
  nodes: Nodes<S, any>,
): Array<NodeId> {
  const lcaId = LCA(current, destination, nodes);
  const lca = nodes[lcaId];

  const pathFromSourceToLca: ProvenanceNode<S, any>[] = [];
  const pathFromDestinationToLca: ProvenanceNode<S, any>[] = [];

  let [source, target] = [current, destination];

  while (source.id !== lca.id) {
    pathFromSourceToLca.push(source);
    if (isStateNode(source)) source = nodes[source.parent];
  }

  pathFromSourceToLca.push(source);

  while (target.id !== lca.id) {
    pathFromDestinationToLca.push(target);
    if (isStateNode(target)) target = nodes[target.parent];
  }

  const reversedPath = pathFromDestinationToLca.reverse();

  return [...pathFromSourceToLca, ...reversedPath].map((node) => node.id);
}

function isNextNodeUp(
  source: ProvenanceNode<unknown, any>,
  target: ProvenanceNode<unknown, any>,
): boolean {
  if (isStateNode(source) && source.parent === target.id) return true;
  if (isStateNode(target) && target.parent === source.id) return false;

  throw new Error(
    'Incorrect use of function. Nodes are not connected to each other.',
  );
}

type TreeNode = Omit<ProvenanceNode<any, any>, 'children' | 'name'> & {
    name: string;
    children: TreeNode[];
};

function getTreeFromNode(
  node: ProvenanceNode<any, any>,
  nodes: Nodes<any, any>,
): TreeNode {
  return {
    ...node,
    children: node.children.map((n) => getTreeFromNode(nodes[n], nodes)),
    name: `${node.label}`,
  };
}
