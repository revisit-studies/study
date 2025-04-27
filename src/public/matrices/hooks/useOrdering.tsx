/* eslint-disable camelcase */
import {
  optimal_leaf_order, distance, pca_order, permute,
} from 'reorder.js';

import { useLayoutEffect, useState } from 'react';
import { meanAccesor, snrAccesor, stdAccesor } from '../utils/Accesors';

import { link } from '../utils/Interfaces';

function linksToMatrix(property: string, links: link[]) {
  let accesor = meanAccesor;
  if (property === 'snr') {
    accesor = snrAccesor;
  } else if (property === 'std') {
    accesor = stdAccesor;
  }
  const nodes = Array.from(
    new Set(links.flatMap(({ origin, destination }) => [origin, destination])),
  );

  const indexMap = new Map(nodes.map((node, index) => [node, index]));

  const matrix = Array.from({ length: nodes.length }, () => Array(nodes.length).fill(0));

  links.forEach((d: link) => {
    const { origin, destination } = d;
    const value = accesor(d) || 0;
    matrix[indexMap.get(origin)!][indexMap.get(destination)!] = value;
  });

  return { matrix, nodes };
}

export function getClusterOrder(ordering: string, property: string, links: link[]) {
  const { matrix, nodes } = linksToMatrix(property, links);

  let orderingFunction;
  let order;
  if (ordering === 'optimal') {
    orderingFunction = optimal_leaf_order();
    orderingFunction.distance(distance.euclidean);
    orderingFunction.linkage('complete');
    order = orderingFunction(matrix);
  } else {
    // let graph = reorder.mat2graph(matrix, true);
    orderingFunction = pca_order;
    order = orderingFunction(matrix);
  }

  const newOrder = permute(nodes, order);
  return newOrder;
}
export function useOrdering(data: link[], clusterMode: string, clusterVar: string) {
  const [orderedOrigins, setOrderedOrigins] = useState<string[] | null>(null);
  const [orderedDestinations, setOrderedDestinations] = useState<string[] | null>(null);

  useLayoutEffect(() => {
    if (data.length > 1) {
      let order;
      if (clusterMode === 'none') {
        order = null;
      } else {
        order = getClusterOrder(clusterMode, clusterVar, data);
      }
      setOrderedOrigins(order);
      setOrderedDestinations(order);
    }
  }, [data, clusterMode, clusterVar]);

  return {
    orderedOrigins,
    orderedDestinations,
    setOrderedOrigins,
    setOrderedDestinations,
  };
}
