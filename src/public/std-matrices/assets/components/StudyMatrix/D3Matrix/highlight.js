function drawHighlightRect(vis, x, y, width, height) {
  vis.highlightsGroup
    .append('rect')
    .attr('class', 'highlight')
    .attr('x', x)
    .attr('y', y)
    .attr('width', width)
    .attr('height', height);
}
export function highlight(vis, link) {
  vis.highlightsGroup.selectAll('*').remove();
  if (!link) return;

  const x = vis.xScale(link.origin);
  const y = vis.yScale(link.destination);
  const leftEdge = -vis.margin.left;
  const topEdge = -vis.margin.top;
  const fullHeight = vis.squareSize + vis.margin.top;
  const fullWidth = vis.squareSize + vis.margin.left;

  drawHighlightRect(vis, leftEdge, y, fullWidth, vis.cellSize);
  drawHighlightRect(vis, y, topEdge, vis.cellSize, fullHeight);

  if (x !== y) {
    drawHighlightRect(vis, leftEdge, x, fullWidth, vis.cellSize);
    drawHighlightRect(vis, x, topEdge, vis.cellSize, fullHeight);
  }
}

export function removeHighlight(vis) {
  vis.highlightedLinks = null;
  vis.highlightsGroup.selectAll('*').remove();
}

export function showHighlight(vis, data) {
  if (
    vis.highlightedLinks
    && vis.highlightedLinks.origin === data.origin
    && vis.highlightedLinks.destination === data.destination
  ) return;
  const obj = { origin: data.origin, destination: data.destination };
  vis.highlightedLinks = obj;

  vis.chart.selectAll('.highlight').remove();
  if (data === null) {
    vis.trrack.apply('End Highlighting', vis.actions.endHighlightLinks(null));
    removeHighlight(vis);
    return;
  }

  vis.trrack.apply('Highlighting', vis.actions.highlightLinks(obj));
  highlight(vis, data);
}

export function drawHorizontalHighlightRect(vis, destinations) {
  const leftEdge = -vis.margin.left;
  const fullWidth = vis.squareSize + vis.margin.left;

  vis.horizontalHighlightsGroup
    .selectAll('.horizontal-highlight')
    .data(destinations, (d) => d)
    .join('rect')
    .attr('class', 'horizontal-highlight')
    .attr('x', leftEdge)
    .attr('y', (destination) => vis.yScale(destination))
    .attr('width', fullWidth)
    .attr('height', vis.cellSize);
}
