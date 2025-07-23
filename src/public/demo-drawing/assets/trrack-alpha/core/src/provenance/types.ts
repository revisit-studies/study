import { PayloadAction } from '@reduxjs/toolkit';
import {
  Artifact,
  CurrentChangeHandler,
  Metadata,
  NodeId,
  ProvenanceGraphStore,
  ProvenanceNode,
  RootNode,
  SideEffects,
  UnsubscribeCurrentChangeListener,
} from '../graph';
import { ProvenanceGraph } from '../graph/graph-slice';
import { Registry } from '../registry';
import { TrrackEvents } from './trrack-events';

export type RecordActionArgs<State, Event extends string> = {
    label: string;
    state: State;
    eventType: Event;
    sideEffects: SideEffects;
    isEphemeral: boolean;
    makeCheckpoint: boolean;
    onlySideEffects?: boolean;
};

export interface Trrack<State, Event extends string> {
    registry: Registry<Event>;
    isTraversing: boolean;
    getState(node?: ProvenanceNode<State, Event>): State;
    graph: ProvenanceGraphStore;
    current: ProvenanceNode<State, Event>;
    root: RootNode<State>;
    record(args: RecordActionArgs<State, Event>): void;
    apply<T extends string, Payload = any>(
        label: string,
        act: PayloadAction<Payload, T>,
        options?: {
            makeCheckpoint?: boolean;
            isEphemeral?: boolean;
        }
    ): any;
    to(node: NodeId): Promise<void>;
    metadata: {
        add(metadata: Record<string, unknown>, node?: NodeId): void;
        latestOfType<T = unknown>(
            type: string,
            node?: NodeId
        ): Metadata<T> | undefined;
        allOfType<T = unknown>(
            type: string,
            node?: NodeId
        ): Metadata<T>[] | undefined;
        latest(node?: NodeId): Record<string, Metadata> | undefined;
        all(node?: NodeId): Record<string, Metadata[]> | undefined;
        types(node?: NodeId): string[];
    };
    artifact: {
        add<A>(artifact: A, node?: NodeId): void;
        latest(node?: NodeId): Artifact | undefined;
        all(node?: NodeId): Artifact[] | undefined;
    };
    annotations: {
        add(annotation: string, node?: NodeId): void;
        latest(node?: NodeId): string | undefined;
        all(node?: NodeId): string[] | undefined;
    };
    bookmarks: {
        add(node?: NodeId): void;
        remove(node?: NodeId): void;
        is(node?: NodeId): boolean;
        toggle(node?: NodeId): void;
    };
    undo(): Promise<void>;
    redo(to?: 'latest' | 'oldest'): Promise<void>;
    currentChange(
        listener: CurrentChangeHandler,
        skipOnNew?: boolean
    ): UnsubscribeCurrentChangeListener;
    done(): void;
    tree(): any;
    on(event: TrrackEvents, listener: (args?: any) => void): void;
    export(): string;
    exportObject(): ProvenanceGraph<State, Event>;
    import(graphString: string): void;
    importObject(graph: ProvenanceGraph<State, Event>): void;
}
