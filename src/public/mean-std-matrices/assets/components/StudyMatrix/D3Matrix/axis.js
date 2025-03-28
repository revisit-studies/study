import * as d3 from 'd3';
import { drawHorizontalHighlightRect, removeHighlight, showHighlight } from './highlight';

function removeFirstOccurrences(sourceArray, elementsToRemove) {
  const newArray = [...sourceArray];

  elementsToRemove.forEach((element) => {
    const index = newArray.indexOf(element);
    if (index !== -1) {
      newArray.splice(index, 1);
    }
  });

  return newArray;
}

export function renderAxis(vis) {
  vis.xAxisG
    .call(
      d3
        .axisTop(vis.xScale)
        .tickSize(-vis.squareSize)
        .tickFormat((d) => (d === vis.orderNode ? `← ${d}` : d)),
    )
    .selectAll('.tick line')
    .attr('stroke', '#ccc')
    .attr('stroke-width', 1)
    .attr('transform', `translate(${vis.cellSize / 2}, 0)`);

  vis.yAxisG
    .call(d3.axisLeft(vis.yScale).tickSize(-vis.squareSize))
    .selectAll('.tick line')
    .attr('stroke', '#ccc')
    .attr('stroke-width', 1)
    .attr('transform', `translate(0, ${vis.cellSize / 2})`);

  vis.xAxisG
    .selectAll('.tick text')
    .attr('transform', 'rotate(-90)')
    .style('text-anchor', 'start')
    .attr('dy', '0.5em')
    .attr('dx', '0.2em')
    .classed('orderNode', (d) => d === vis.orderNode)
    .on('click', (event, d) => {
      const item = d3.select(event.currentTarget);
      const isSelected = item.classed('selected');
      const destinations = vis.data.filter((link) => link.origin === d).map((link) => link.destination);

      if (!isSelected) {
        vis.trrack.apply('Select Destinations', vis.actions.addHorizontalHighligthNode(d));
        vis.highlightedDestinations.push(...destinations);
      } else {
        vis.highlightedDestinations = removeFirstOccurrences(vis.highlightedDestinations, destinations);
        vis.trrack.apply('Unselect Destinations', vis.actions.removeHorizontalHighligthNode(d));
      }

      const tmp = new Set(vis.highlightedDestinations);
      const highlightedArray = Array.from(tmp);
      drawHorizontalHighlightRect(vis, highlightedArray);

      item.classed('selected', !isSelected);
    })
    .on('contextmenu', function (event, d) {
      event.preventDefault();
      event.stopPropagation();
      const item = d3.select(this);
      const isSelected = item.classed('orderNode');

      if (!isSelected) {
        vis.trrack.apply('Order by Node', vis.actions.orderByNode(d));
        vis.orderByNode(d);
      } else {
        vis.trrack.apply('Remove Order by Node', vis.actions.orderByNode(null));
        vis.orderByNode(null);
      }
    });

  vis.yAxisG
    .selectAll('.tick text')

    .on('click', function (e, d) {
      const item = d3.select(this);
      const isSelected = item.classed('selected');

      if (!isSelected) {
        vis.trrack.apply('Add Node', vis.actions.addNode(d));
      } else {
        vis.trrack.apply('Remove Node', vis.actions.removeNode(d));
      }

      item.classed('selected', !isSelected);
    });

  vis.chart.selectAll('.domain').attr('stroke', '#ccc').attr('stroke-width', 1);

  const ticks = vis.chart.selectAll('.tick text').style('cursor', 'pointer');

  ticks
    .on('mouseover', (e, d) => {
      const data = { origin: d, destination: d };
      showHighlight(vis, data);
    })
    .on('mouseleave', () => {
      removeHighlight(vis);
    });
}
