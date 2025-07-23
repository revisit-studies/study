/* eslint-disable @typescript-eslint/no-explicit-any */
import { PayloadAction } from '@reduxjs/toolkit';
import { Operation } from 'fast-json-patch';

import { FlavoredId, ID } from '../../utils';

export type NodeId = FlavoredId<string, 'Node'>;

type Checkpoint<State> = {
    type: 'checkpoint';
    val: State;
};

type Patches = {
    type: 'patch';
    checkpointRef: NodeId;
    val: Array<Operation>;
};

export type StateLike<State> = Checkpoint<State> | Patches;

/**
 * Node Artifact Type
 */

/**
 * Artifact Types
 */
export type ArtifactId = FlavoredId<string, 'Artifact'>;

export type Artifact = {
    id: ArtifactId;
    createdOn: number;
    val: unknown;
};

export type NodeArtifact = Array<Artifact>;

/**
 * Node Metadata Type
 */
export type MetadataId = FlavoredId<string, 'Metadata'>;

export type Metadata<T = unknown> = {
    id: MetadataId;
    type: string;
    createdOn: number;
    val: T;
};

type NodeMetadata = {
    annotation: Array<Metadata<string>>;
    bookmark: Array<Metadata<boolean>>;
    [key: string]: Array<Metadata<unknown>>;
};

/**
 * Node Types
 */
type BaseNode<State> = {
    label: string;
    id: NodeId;
    createdOn: number;
    artifacts: NodeArtifact;
    meta: NodeMetadata;
    children: NodeId[];
    state: StateLike<State>;
    level: number;
};

export type RootNode<State> = BaseNode<State> & { event: 'Root' };

export type SideEffects = {
    do: Array<PayloadAction<any, any>>;
    undo: Array<PayloadAction<any, any>>;
};

export type StateNode<State, Event extends string> = BaseNode<State> & {
    event: Event;
    parent: NodeId;
    sideEffects: SideEffects;
    isEphemeral?: boolean;
};

export type ProvenanceNode<State, Event extends string> =
    | RootNode<State>
    | StateNode<State, Event>;

export type Nodes<State, Event extends string> = Record<
    string,
    ProvenanceNode<State, Event>
>;

export function isStateNode<State, Event extends string>(
    node: ProvenanceNode<State, Event>
): node is StateNode<State, Event> {
    return 'parent' in node;
}

export function isRootNode<State, Event extends string>(
    node: ProvenanceNode<State, Event>
): node is RootNode<State> {
    return !isStateNode(node);
}

export function createRootNode<State>(args: {
    state: State;
    initialMetadata?: Record<string, unknown>;
    initialArtifact?: unknown;
    label?: string;
}): RootNode<State> {
    const { label = undefined, state, initialArtifact, initialMetadata } = args;

    const commonMetadata: NodeMetadata = {
        annotation: [],
        bookmark: [],
    };

    const meta = Object.keys(initialMetadata || {}).reduce<NodeMetadata>(
        (acc: NodeMetadata, key) => {
            acc[key] = [];
            if (initialMetadata && initialMetadata[key]) {
                acc[key].push({
                    type: key,
                    id: ID.get(),
                    val: initialMetadata[key],
                    createdOn: Date.now(),
                });
            }
            return acc;
        },
        commonMetadata
    );

    const artifacts = initialArtifact
        ? [
              {
                  id: ID.get(),
                  createdOn: Date.now(),
                  val: initialArtifact,
              },
          ]
        : [];

    return {
        id: ID.get(),
        label: label || 'Root',
        event: 'Root',
        children: [],
        level: 0,
        createdOn: Date.now(),
        meta,
        artifacts,
        state: {
            type: 'checkpoint',
            val: state,
        },
    };
}

export function createStateNode<State, Event extends string>({
    parent,
    state,
    label,
    sideEffects = {
        do: [],
        undo: [],
    },
    initialMetadata,
    isEphemeral = false,
    initialArtifact,
    event,
}: {
    parent: ProvenanceNode<State, Event>;
    state: StateLike<State>;
    initialMetadata?: Record<string, unknown>;
    initialArtifact?: unknown;
    label: string;
    sideEffects?: SideEffects;
    isEphemeral?: boolean;
    event: Event;
}): StateNode<State, Event> {
    const commonMetadata: NodeMetadata = {
        annotation: [],
        bookmark: [],
    };

    const meta = Object.keys(initialMetadata || {}).reduce<NodeMetadata>(
        (acc: NodeMetadata, key) => {
            acc[key] = [];
            if (initialMetadata && initialMetadata[key]) {
                acc[key].push({
                    type: key,
                    id: ID.get(),
                    val: initialMetadata[key],
                    createdOn: Date.now(),
                });
            }
            return acc;
        },
        commonMetadata
    );

    const artifacts = initialArtifact
        ? [
              {
                  id: ID.get(),
                  createdOn: Date.now(),
                  val: initialArtifact,
              },
          ]
        : [];

    return {
        id: ID.get(),
        label,
        event,
        isEphemeral,
        children: [],
        parent: parent.id,
        createdOn: Date.now(),
        meta,
        artifacts,
        sideEffects,
        state,
        level: parent.level + 1,
    };
}
