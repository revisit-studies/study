/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSlice, PayloadAction, Slice } from '@reduxjs/toolkit';

import { castDraft } from 'immer';
import { ID } from '../utils';
import { createRootNode, NodeId, Nodes, StateNode } from './components';

type AddMetadataPayload = {
    id: NodeId;
    meta: Record<string, unknown>;
};

type AddArtifactPayload = {
    id: NodeId;
    artifact: unknown;
};

export type ProvenanceGraph<State, Event extends string> = {
    nodes: Nodes<State, Event>;
    current: NodeId;
    root: NodeId;
};

type GraphSlice<S, E extends string> = Slice<ProvenanceGraph<S, E>>;

export type ProvenanceGraphActions<S, E extends string> = GraphSlice<
    S,
    E
>['actions'];

// Maybe swithc to reduxtoolkit createEntityAdapter

export function graphSliceCreator<State, Event extends string>(
    initialState: State,
    args: {
        artifact?: unknown;
        metadata?: Record<string, unknown>;
        rootLabel?: string;
    } = {}
) {
    const {
        artifact = undefined,
        metadata = undefined,
        rootLabel = 'Root',
    } = args;

    const root = createRootNode<State>({
        state: initialState,
        label: rootLabel,
        initialArtifact: artifact,
        initialMetadata: metadata,
    });

    const graph: ProvenanceGraph<State, Event> = {
        nodes: {
            [root.id]: root,
        },
        root: root.id,
        current: root.id,
    };

    const slice = createSlice({
        name: 'provenance-graph',
        initialState: graph,
        reducers: {
            addMetadata(g, action: PayloadAction<AddMetadataPayload>) {
                const { id, meta } = action.payload;
                const existingMetadata = g.nodes[id].meta;

                const metaData = Object.keys(meta).reduce((acc, key) => {
                    if (!acc[key]) {
                        acc[key] = [];
                    }
                    acc[key].push({
                        type: key,
                        id: ID.get(),
                        val: meta[key],
                        createdOn: Date.now(),
                    });

                    return acc;
                }, existingMetadata);

                g.nodes[action.payload.id].meta = metaData;
            },
            addArtifact(g, action: PayloadAction<AddArtifactPayload>) {
                g.nodes[action.payload.id].artifacts.push({
                    id: ID.get(),
                    createdOn: Date.now(),
                    val: castDraft(action.payload.artifact),
                });
            },
            changeCurrent(g, action: PayloadAction<NodeId>) {
                g.current = action.payload;
            },
            addNode(g, { payload }: PayloadAction<StateNode<State, Event>>) {
                g.nodes[payload.id] = payload as any;
                g.nodes[payload.parent].children.push(payload.id);
                g.current = payload.id;
            },
            load(_, { payload }: PayloadAction<ProvenanceGraph<State, Event>>) {
                return payload;
            },
        },
    });

    return slice;
}
