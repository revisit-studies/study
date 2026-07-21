// @vitest-environment jsdom

import { render, waitFor } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import {
  beforeEach, describe, expect, test, vi,
} from 'vitest';
import type { ConfigureTrrackOptions } from '@trrack/core';
import {
  RevisitProvenanceProvider,
} from '../useRevisitTrrack';
import type { TrrackedProvenance, UseTrrack } from '../../types';

const trrackMock = vi.hoisted(() => {
  let listener: (() => void) | undefined;
  let subscribed = false;
  const unsubscribe = vi.fn(() => {
    subscribed = false;
    listener = undefined;
    return true;
  });
  const trrack = {
    graph: {
      backend: {} as TrrackedProvenance,
    },
    currentChange: vi.fn((nextListener: () => void) => {
      listener = nextListener;
      subscribed = true;
      return unsubscribe;
    }),
  };

  return {
    emit(provenance: TrrackedProvenance) {
      trrack.graph.backend = provenance;
      listener?.();
    },
    initializeTrrack: vi.fn(() => trrack),
    isSubscribed: () => subscribed,
    reset() {
      listener = undefined;
      subscribed = false;
      unsubscribe.mockClear();
      trrack.currentChange.mockClear();
      trrack.graph.backend = {} as TrrackedProvenance;
    },
    trrack,
    unsubscribe,
  };
});

vi.mock('@trrack/core', () => ({
  initializeTrrack: trrackMock.initializeTrrack,
}));

const rootNode = {
  id: 'root', createdOn: 100, children: [],
} as unknown as TrrackedProvenance['nodes'][string];
const childNode = {
  id: 'child', parent: 'root', createdOn: 200, children: [],
} as unknown as TrrackedProvenance['nodes'][string];
const branchNode = {
  id: 'branch', parent: 'root', createdOn: 300, children: [],
} as unknown as TrrackedProvenance['nodes'][string];

function makeGraph(
  current: string,
  nodes: TrrackedProvenance['nodes'] = { root: rootNode },
): TrrackedProvenance {
  return {
    root: 'root',
    current,
    nodes,
  } as TrrackedProvenance;
}

function setupStimulus(
  onProvenanceChange: (provenance: TrrackedProvenance) => void,
  onLayout?: () => void,
) {
  trrackMock.trrack.graph.backend = makeGraph('root');
  const options = {
    registry: {},
    initialState: { count: 0 },
  } as ConfigureTrrackOptions<{ count: number }, string>;

  function Stimulus({ useTrrack }: { useTrrack: UseTrrack }) {
    useTrrack(options);
    useLayoutEffect(() => {
      onLayout?.();
    }, []);
    return null;
  }

  return render(
    <RevisitProvenanceProvider onProvenanceChange={onProvenanceChange}>
      {(useTrrack) => <Stimulus useTrrack={useTrrack} />}
    </RevisitProvenanceProvider>,
  );
}

describe('useRevisitTrrack', () => {
  beforeEach(() => {
    trrackMock.reset();
  });

  test('records apply, undo, redo, and post-undo branches in chronological order', async () => {
    const reported: TrrackedProvenance[] = [];
    setupStimulus((provenance) => reported.push(provenance));

    await waitFor(() => expect(reported).toHaveLength(1));

    const linearNodes = {
      root: { ...rootNode, children: ['child'] },
      child: childNode,
    } as TrrackedProvenance['nodes'];
    trrackMock.emit(makeGraph('child', linearNodes));
    trrackMock.emit(makeGraph('root', linearNodes));
    trrackMock.emit(makeGraph('child', linearNodes));
    trrackMock.emit(makeGraph('root', linearNodes));
    trrackMock.emit(makeGraph('branch', {
      root: { ...rootNode, children: ['child', 'branch'] },
      child: childNode,
      branch: branchNode,
    } as TrrackedProvenance['nodes']));

    const traversalEvents = reported.at(-1)!.traversalEvents!;
    expect(traversalEvents.map(({ nodeId }) => nodeId)).toEqual([
      'root', 'child', 'root', 'child', 'root', 'branch',
    ]);
    expect(traversalEvents.map(({ createdOn }) => createdOn)).toEqual(
      [...traversalEvents]
        .map(({ createdOn }) => createdOn)
        .sort((first, second) => first - second),
    );
  });

  test('subscribes before publishing and unsubscribes when the stimulus unmounts', async () => {
    const onProvenanceChange = vi.fn(() => {
      expect(trrackMock.isSubscribed()).toBe(true);
    });
    const rendered = setupStimulus(onProvenanceChange);

    await waitFor(() => expect(onProvenanceChange).toHaveBeenCalledTimes(1));
    rendered.unmount();
    trrackMock.emit(makeGraph('root'));

    expect(trrackMock.unsubscribe).toHaveBeenCalledTimes(1);
    expect(onProvenanceChange).toHaveBeenCalledTimes(1);
  });

  test('captures transitions from stimulus layout effects', async () => {
    const onProvenanceChange = vi.fn();
    setupStimulus(onProvenanceChange, () => {
      trrackMock.emit(makeGraph('child', {
        root: { ...rootNode, children: ['child'] },
        child: childNode,
      } as TrrackedProvenance['nodes']));
    });

    await waitFor(() => expect(onProvenanceChange).toHaveBeenCalledTimes(2));
    expect(onProvenanceChange.mock.calls[1][0].traversalEvents?.map(({ nodeId }: { nodeId: string }) => nodeId)).toEqual([
      'root', 'child',
    ]);
  });
});
