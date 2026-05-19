// use effect to control the current provenance node based on the changing playtime.

import { useEffect, useMemo } from 'react';
import { initializeTrrack, Registry } from '@trrack/core';
import { TrrackedProvenance } from '../../store/types';
import { ResponseBlockLocation } from '../../parser/types';
import { findNodeAtTime } from '../../utils/findNodeAtTime';

export function useUpdateProvenance(location: ResponseBlockLocation, playTime: number, provGraph: TrrackedProvenance | undefined, currentNode: string | undefined, setCurrentNode: (node: string | null, _location: ResponseBlockLocation) => void, saveProvenance?: (prov: unknown) => void) {
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

    if (!currentNode || !provGraph.nodes[currentNode]) {
      setCurrentNode(provGraph.root as string, location);
      saveProvenance({ prov: trrackInstance.getState(provGraph.nodes[provGraph.root]), location });

      return;
    }

    const foundNodeId = findNodeAtTime(currentNode, playTime, provGraph.nodes);

    if (foundNodeId !== currentNode) {
      setCurrentNode(foundNodeId, location);
      saveProvenance({ prov: trrackInstance.getState(provGraph.nodes[foundNodeId]), location });
    }
  }, [currentNode, playTime, provGraph, location, setCurrentNode, trrackInstance, saveProvenance]);
}
