// use effect to control the current provenance node based on the changing playtime.

import { useEffect, useMemo } from 'react';
import { initializeTrrack, Registry } from '@trrack/core';
import { TrrackedProvenance } from '../../store/types';
import { ResponseBlockLocation } from '../../parser/types';
import { getReplaySelection } from './provenanceReplay';

export function useUpdateProvenance(location: ResponseBlockLocation, playTime: number, provGraph: TrrackedProvenance | undefined, currentNode: string | undefined, setCurrentNode: (node: string | null, _location: ResponseBlockLocation, createdOn?: number) => void, saveProvenance?: (prov: unknown) => void) {
  const trrackInstance = useMemo(() => {
    const reg = Registry.create();

    const trrack = initializeTrrack({ registry: reg, initialState: {} });

    if (provGraph) {
      trrack.importObject(structuredClone(provGraph));
    }

    return trrack;
  }, [provGraph]);

  useEffect(() => {
    if (!saveProvenance) {
      return;
    }

    if (!provGraph) {
      if (currentNode) {
        setCurrentNode(null, location);
        saveProvenance({ prov: null, location });
      }
      return;
    }

    const replaySelection = getReplaySelection(provGraph, playTime, currentNode);

    if (replaySelection.nodeId !== currentNode) {
      if (replaySelection.fromTraversal) {
        setCurrentNode(replaySelection.nodeId, location, replaySelection.createdOn);
      } else {
        setCurrentNode(replaySelection.nodeId, location);
      }
      saveProvenance({ prov: trrackInstance.getState(provGraph.nodes[replaySelection.nodeId]), location });
    }
  }, [currentNode, playTime, provGraph, location, setCurrentNode, trrackInstance, saveProvenance]);
}
