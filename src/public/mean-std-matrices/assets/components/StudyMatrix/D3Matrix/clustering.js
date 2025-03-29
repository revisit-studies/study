import * as d3 from 'd3';
import * as reorder from 'reorder.js';
import { drawHorizontalHighlightRect } from './highlight';

function linksToMatrix(vis, property) {
  const links = vis.data;
  let accesor = vis.meanAccesor;
  if (property === 'snr') {
    accesor = vis.snrAccesor;
  } else if (property === 'std') {
    accesor = vis.stdAccesor;
  }
  const nodes = Array.from(new Set(links.flatMap(({ origin, destination }) => [origin, destination])));

  const indexMap = new Map(nodes.map((node, index) => [node, index]));

  const matrix = Array.from({ length: nodes.length }, () => Array(nodes.length).fill(0));

  links.forEach((link) => {
    const { origin, destination } = link;
    const value = accesor(link) || 0;
    matrix[indexMap.get(origin)][indexMap.get(destination)] = value;
  });

  return { matrix, nodes };
}

export function clusterMatrix(vis, ordering, property) {
  const { matrix, nodes } = linksToMatrix(vis, property);

  let orderingFunction;
  let order;
  if (ordering === 'optimal') {
    orderingFunction = reorder.optimal_leaf_order();
    orderingFunction.distance(reorder.distance.manhattan);
    orderingFunction.linkage('complete');
    order = orderingFunction(matrix);
  } else {
    // let graph = reorder.mat2graph(matrix, true);
    orderingFunction = reorder.pca_order;
    order = orderingFunction(matrix);
  }

  const newOrder = reorder.permute(nodes, order);

  vis.xScale = d3.scaleBand().range([0, vis.squareSize]).domain(newOrder);
  vis.yScale = d3.scaleBand().range([0, vis.squareSize]).domain(newOrder);
  vis.renderVis();
  vis.chart.selectAll('.order-highlight').remove();
  const tmp = new Set(vis.highlightedDestinations);
  const highlightedArray = Array.from(tmp);
  drawHorizontalHighlightRect(vis, highlightedArray);
}
