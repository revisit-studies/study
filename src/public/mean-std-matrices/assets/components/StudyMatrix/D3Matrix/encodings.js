import * as d3 from 'd3';

// Utility functions
function createSizeScale(nSteps, cellSize) {
  const stepSize = cellSize / nSteps;
  return Array.from({ length: nSteps }, (_, i) => stepSize * (i + 1)).reverse();
}

function createMarkScale(nSteps, cellSize) {
  const stepSize = cellSize / (nSteps + 1);
  return Array.from({ length: nSteps }, (_, i) => stepSize * (i + 1));
}

function createLinearScale(steps, min = 0, max = 45) {
  const stepSize = (max - min) / (steps - 1);
  return Array.from({ length: steps }, (_, i) => min + stepSize * i);
}

function setMeanColorScheme(vis) {
  if (vis.colorScale === 'viridis' || vis.colorScale === 'weather') {
    const range = createLinearScale(vis.nMeans, 0, 1);
    vis.meanColorScheme = range.map((t) => d3.interpolateViridis(t)).reverse();
  } else if (vis.colorScale === 'reds') {
    vis.meanColorScheme = d3.schemeYlOrRd[vis.nMeans];
  } else {
    vis.meanColorScheme = d3.schemeBlues[vis.nMeans];
  }
}

function configureScales(vis) {
  vis.meanScale = d3.scaleQuantize().domain([vis.meanMin, vis.meanMax]).range(vis.meanColorScheme);

  if (vis.isSnr) vis.deviationSteps = vis.deviationSteps.reverse();

  vis.deviationScale = d3.scaleQuantize().domain([vis.stdMin, vis.stdMax]).range(vis.deviationSteps);

  vis.meanIntervals = vis.meanScale.range().map((value) => vis.meanScale.invertExtent(value));
  vis.deviationIntervals = vis.deviationScale.range().map((value) => vis.deviationScale.invertExtent(value));

  console.warn('Scales configured:', {
    meanSteps: vis.meanColorScheme,
    meanIntervals: vis.meanIntervals,
    deviationSteps: vis.deviationSteps,
    deviationIntervals: vis.deviationIntervals,
  });
}

function createBaseCell(vis) {
  return vis.chart
    .selectAll('.cell')
    .append('rect')
    .attr('width', vis.cellSize)
    .attr('height', vis.cellSize)
    .attr('fill', (d) => vis.meanScale(vis.meanAccesor(d)));
}

export function barEncode(vis, cells) {
  // Mean bar
  cells
    .append('rect')
    .attr('fill', '#1f77b4')
    .attr('width', vis.cellSize * vis.barsProportion)
    .attr('height', (d) => vis.meanScale(vis.meanAccesor(d)))
    .attr('y', (d) => vis.cellSize - vis.meanScale(vis.meanAccesor(d)));

  // Deviation bar
  cells
    .append('rect')
    .attr('fill', '#ff7f0e')
    .attr('width', vis.cellSize * (1 - vis.barsProportion))
    .attr('height', (d) => vis.deviationScale(vis.deviationAccesor(d)))
    .attr('x', vis.cellSize * vis.barsProportion)
    .attr('y', (d) => vis.cellSize - vis.deviationScale(vis.deviationAccesor(d)));
}

export function encodeRotationCells(vis, cells) {
  const markWidth = vis.cellSize * 0.8;
  const markHeight = vis.cellSize * 0.2;
  const center = vis.cellSize / 2;
  const offsetX = (vis.cellSize - markWidth) / 2;
  const offsetY = (vis.cellSize - markHeight) / 2;

  cells
    .append('rect')
    .attr('class', 'rotationMark')
    .attr('fill', 'black')
    .attr('width', markWidth)
    .attr('height', markHeight)
    .attr('x', offsetX)
    .attr('y', offsetY)
    .attr('transform', (d) => {
      const angle = -vis.deviationScale(vis.deviationAccesor(d));
      return `rotate(${angle}, ${center}, ${center})`;
    });
}

export function encodeMarkCells(vis, cells) {
  cells
    .append('rect')
    .attr('class', 'mark')
    .attr('fill', 'black')
    .attr('width', (d) => vis.deviationScale(vis.deviationAccesor(d)))
    .attr('height', (d) => vis.deviationScale(vis.deviationAccesor(d)))
    .attr('x', (d) => (vis.cellSize - vis.deviationScale(vis.deviationAccesor(d))) / 2)
    .attr('y', (d) => (vis.cellSize - vis.deviationScale(vis.deviationAccesor(d))) / 2);
}

export function encodeSizeCells(vis, cells) {
  cells
    .attr('width', (d) => vis.deviationScale(vis.deviationAccesor(d)))
    .attr('height', (d) => vis.deviationScale(vis.deviationAccesor(d)))
    .attr('x', (d) => (vis.cellSize - vis.deviationScale(vis.deviationAccesor(d))) / 2)
    .attr('y', (d) => (vis.cellSize - vis.deviationScale(vis.deviationAccesor(d))) / 2);
}

function barsEncode(vis) {
  // Configure scales specifically for bars encoding
  vis.meanSteps = createLinearScale(vis.nMeans, vis.cellSize * 0.2, vis.cellSize);
  vis.deviationSteps = createLinearScale(vis.nStds, vis.cellSize * 0.2, vis.cellSize);

  vis.meanScale = d3.scaleQuantize().domain([vis.meanMin, vis.meanMax]).range(vis.meanSteps);

  if (vis.isSnr) vis.deviationSteps = vis.deviationSteps.reverse();

  vis.deviationScale = d3.scaleQuantize().domain([vis.stdMin, vis.stdMax]).range(vis.deviationSteps);

  // Store intervals
  vis.meanIntervals = vis.meanScale.range().map((value) => vis.meanScale.invertExtent(value));
  vis.deviationIntervals = vis.deviationScale.range().map((value) => vis.deviationScale.invertExtent(value));

  // Encode bars
  barEncode(vis, vis.chart.selectAll('.cell'));
}

function weatherEncode(vis) {
  vis.deviationSteps = vis.isSnr
    ? createLinearScale(vis.nStds, 0.2, 1).reverse()
    : createLinearScale(vis.nStds, 0.2, 1).reverse();

  configureScales(vis);

  vis.chart
    .selectAll('.cell')
    .append('rect')
    .attr('width', vis.cellSize)
    .attr('height', vis.cellSize)
    .attr('fill', (d) => vis.meanScale(vis.meanAccesor(d)))
    .attr('opacity', (d) => vis.deviationScale(vis.deviationAccesor(d)));
}

function rotationMarkEncode(vis) {
  vis.deviationSteps = createLinearScale(vis.nStds);

  configureScales(vis);

  createBaseCell(vis);

  encodeRotationCells(vis, vis.chart.selectAll('.cell'));
}

function markEncode(vis) {
  vis.deviationSteps = createMarkScale(vis.nStds, vis.cellSize * 0.8);
  configureScales(vis);

  createBaseCell(vis);

  encodeMarkCells(vis, vis.chart.selectAll('.cell'));
}

function sizeEncode(vis) {
  vis.deviationSteps = createSizeScale(vis.nStds, vis.cellSize);
  configureScales(vis);

  vis.chart
    .selectAll('.cell')
    .append('rect')
    .attr('fill', 'transparent')
    .attr('width', vis.cellSize)
    .attr('height', vis.cellSize);

  const cells = vis.chart
    .selectAll('.cell')
    .append('rect')
    .attr('fill', (d) => vis.meanScale(vis.meanAccesor(d)));

  encodeSizeCells(vis, cells);
}

function simpleEncode(vis) {
  vis.deviationScale = () => {};
  vis.meanScale = d3.scaleQuantize().domain([vis.meanMin, vis.meanMax]).range(vis.meanColorScheme);

  createBaseCell(vis);

  vis.meanIntervals = vis.meanScale.range().map((value) => vis.meanScale.invertExtent(value));
}

const ENCODING_FUNCTIONS = {
  squareMark: markEncode,
  rotationMark: rotationMarkEncode,
  cellSize: sizeEncode,
  weather: weatherEncode,
  bars: barsEncode,
};

export function encodeCells(vis) {
  console.warn('encoding:', vis.encoding);

  vis.chart.selectAll('.cell').selectAll('*').remove();

  setMeanColorScheme(vis);

  const encodingFunction = ENCODING_FUNCTIONS[vis.encoding] || simpleEncode;
  encodingFunction(vis);
}
