// use effect to control the current provenance node based on the changing playtime.

import { useEffect, useMemo } from 'react';
import { initializeTrrack, isRootNode, Registry } from '@trrack/core';
import { TrrackedProvenance } from '../../store/types';
import { useStoreActions, useStoreDispatch } from '../../store/store';
import { ResponseBlockLocation } from '../../parser/types';

export function useUpdateProvenance(location: ResponseBlockLocation, playTime: number, provGraph: TrrackedProvenance | undefined, currentNode: string | undefined, setCurrentNode: (node: string | null, _location: ResponseBlockLocation) => void) {
  const {
    saveAnalysisState,
  } = useStoreActions();
  const storeDispatch = useStoreDispatch();

  const trrackInstance = useMemo(() => {
    const reg = Registry.create();

    const trrack = initializeTrrack({ registry: reg, initialState: {} });

    if (provGraph) {
      trrack.importObject(structuredClone(provGraph));
    }

    return trrack;
  }, [provGraph]);

  useEffect(() => {
    if (!provGraph) {
      if (currentNode) {
        setCurrentNode(null, location);
        storeDispatch(saveAnalysisState({ prov: null, location }));
      }
      return;
    }

    if (!currentNode || !provGraph.nodes[currentNode]) {
      setCurrentNode(provGraph.root as string, location);
      storeDispatch(saveAnalysisState({ prov: trrackInstance.getState(provGraph.nodes[provGraph.root]), location }));

      return;
    }

    let tempNode = provGraph.nodes[currentNode];

    while (true) {
      if (playTime < tempNode.createdOn) {
        if (!isRootNode(tempNode)) {
          const parentNode = tempNode.parent;

          tempNode = provGraph.nodes[parentNode];
        } else break;
      } else if (tempNode.children.length > 0) {
        const child = tempNode.children[0];

        if (playTime > provGraph.nodes[child].createdOn) {
          tempNode = provGraph.nodes[child];
        } else break;
      } else break;
    }

    if (tempNode.id !== currentNode) {
      setCurrentNode(tempNode.id, location);
      storeDispatch(saveAnalysisState({ prov: trrackInstance.getState(tempNode), location }));
    }
  }, [currentNode, playTime, provGraph, storeDispatch, saveAnalysisState, location, setCurrentNode, trrackInstance]);
}
