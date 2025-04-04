const lineColor = 'black';

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

function drawHighlightRect(vis, x, y, width, height) {
  vis.chart.append('rect').attr('class', 'highlight').attr('x', x).attr('y', y)
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
    },
    {
      x1: x + width + margin,
      y1: y - margin,
      x2: x + width + margin,
      y2: y + height + margin,
    },
    {
      x1: x - margin,
      y1: y + height + margin,
      x2: x + width + margin,
      y2: y + height + margin,
    },
    {
      x1: x - margin,
      y1: y - margin,
      x2: x - margin,
      y2: y + height + margin,
    },
  ];

  edges.forEach((edge) => {
    vis.chart
      .append('line')
      .attr('class', 'highlight')
      .attr('x1', edge.x1)
      .attr('y1', edge.y1)
      .attr('x2', edge.x2)
      .attr('y2', edge.y2)
      .attr('stroke', lineColor)
      .attr('stroke-width', 2 * margin)
      .raise();
  });
}

export function drawOrderHighlightRect(vis) {
  const x = vis.xScale(vis.orderNode);
  const y = -vis.margin.top + 2;
  const height = vis.squareSize + vis.margin.top;
  const width = vis.cellSize;

  vis.chart.append('rect').attr('class', 'order-highlight').attr('x', x).attr('y', y)
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
    },
    {
      x1: x + width + margin,
      y1: y - margin,
      x2: x + width + margin,
      y2: y + height + margin,
    },
    {
      x1: x - margin,
      y1: y + height + margin,
      x2: x + width + margin,
      y2: y + height + margin,
    },
    {
      x1: x - margin,
      y1: y - margin,
      x2: x - margin,
      y2: y + height + margin,
    },
  ];

  edges.forEach((edge) => {
    vis.chart
      .append('line')
      .attr('class', 'order-highlight')
      .attr('x1', edge.x1)
      .attr('y1', edge.y1)
      .attr('x2', edge.x2)
      .attr('y2', edge.y2)
      .attr('stroke', lineColor)
      .attr('stroke-width', 2 * margin)
      .raise();
  });
}

export function updateHorizontal(vis) {
  const tmp = new Set(vis.highlightedDestinations);
  const highlightedArray = Array.from(tmp);
  drawHorizontalHighlightRect(vis, highlightedArray);
}

export function updateOrder(vis) {
  vis.chart.selectAll('.order-highlight').remove();
  if (vis.orderNode) drawOrderHighlightRect(vis);
}

export function highlight(vis, link) {
  vis.chart.selectAll('.highlight').remove();
  if (!link) return;

  const x = vis.xScale(link.origin);
  const y = vis.yScale(link.destination);
  const leftEdge = -vis.margin.left + 2;
  const topEdge = -vis.margin.top + 2;
  const fullHeight = vis.squareSize + vis.margin.top;
  const fullWidth = vis.squareSize + vis.margin.left;

  drawHighlightRect(vis, leftEdge, y, fullWidth, vis.cellSize);

  drawHighlightRect(vis, x, topEdge, vis.cellSize, fullHeight);

  if (link.origin !== link.destination) {
    /* x = vis.yScale(link.origin);
    y = vis.xScale(link.destination);
    drawHighlightRect(vis, leftEdge, x, fullWidth, vis.cellSize);
    drawHighlightRect(vis, y, topEdge, vis.cellSize, fullHeight); */
  }
}

export function removeHighlight(vis) {
  vis.highlightedLinks = null;
  vis.chart.selectAll('.highlight').remove();
}

export function showHighlight(vis, data) {
  if (vis.highlightedLinks && vis.highlightedLinks.origin === data.origin && vis.highlightedLinks.destination === data.destination) return;
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
