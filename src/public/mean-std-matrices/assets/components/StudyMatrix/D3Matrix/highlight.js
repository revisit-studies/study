function drawHighlightRect(vis, x, y, width, height) {
  vis.chart
    .append('rect')
    .attr('class', 'highlight')
    .attr('x', x)
    .attr('y', y)
    .attr('width', width)
    .attr('height', height)
    .lower();

  const margin = 1;

  const edges = [
    {
      x1: x - margin,
      y1: y - margin,
      x2: x + width + margin,
      y2: y - margin,
    }, // Arriba
    {
      x1: x + width + margin,
      y1: y - margin,
      x2: x + width + margin,
      y2: y + height + margin,
    }, // Derecha
    {
      x1: x - margin,
      y1: y + height + margin,
      x2: x + width + margin,
      y2: y + height + margin,
    }, // Abajo
    {
      x1: x - margin,
      y1: y - margin,
      x2: x - margin,
      y2: y + height + margin,
    }, // Izquierda
  ];

  // Dibujar las líneas
  edges.forEach((edge) => {
    vis.chart
      .append('line')
      .attr('class', 'highlight')
      .attr('x1', edge.x1)
      .attr('y1', edge.y1)
      .attr('x2', edge.x2)
      .attr('y2', edge.y2)
      .attr('stroke', 'black')
      .attr('stroke-width', 2 * margin)
      .raise();
  });
}
export function highlight(vis, link) {
  vis.chart.selectAll('.highligth').remove();
  if (!link) return;

  let x = vis.xScale(link.origin);
  let y = vis.yScale(link.destination);
  const leftEdge = -vis.margin.left + 2;
  const topEdge = -vis.margin.top + 2;
  const fullHeight = vis.squareSize + vis.margin.top;
  const fullWidth = vis.squareSize + vis.margin.left;

  drawHighlightRect(vis, leftEdge, y, fullWidth, vis.cellSize);

  drawHighlightRect(vis, x, topEdge, vis.cellSize, fullHeight);

  if (link.origin !== link.destination) {
    x = vis.yScale(link.origin);
    y = vis.xScale(link.destination);
    drawHighlightRect(vis, leftEdge, x, fullWidth, vis.cellSize);
    drawHighlightRect(vis, y, topEdge, vis.cellSize, fullHeight);
  }
}

export function removeHighlight(vis) {
  vis.highlightedLinks = null;
  vis.chart.selectAll('.highlight').remove();
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
    .attr('width', fullWidth + 20)
    .attr('height', vis.cellSize);
}
