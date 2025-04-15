import * as d3 from 'd3';

const markColor = 'white';
const sizeProportion = 0.6;
// Utility functions
function createSizeScale(nSteps, cellSize) {
  const stepSize = cellSize / nSteps;
  return Array.from({ length: nSteps }, (_, i) => stepSize * (i + 1)).reverse();
}

function createMarkScale(nSteps, cellSize) {
  const stepSize = (cellSize * sizeProportion) / nSteps;
  return Array.from({ length: nSteps }, (_, i) => stepSize * (i + 1));
}

function createLinearScale(steps, min = 0, max = 45) {
  const stepSize = (max - min) / (steps - 1);
  return Array.from({ length: steps }, (_, i) => min + stepSize * i);
}

function createLogScale(steps, min = 1, max = 45) {
  const stepSize = (max - min) / (steps - 1);
  return Array.from({ length: steps }, (_, i) => min + stepSize * i);
  /* const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  const stepSize = (logMax - logMin) / (steps - 1);
  return Array.from({ length: steps }, (_, i) => Math.pow(10, logMin + stepSize * i)); */
}

function setMeanColorScheme(vis) {
  const range = createLinearScale(vis.nMeans, 0, 1);

  switch (vis.colorScale) {
    case 'viridis':
      vis.meanColorScheme = range.map((t) => d3.interpolateViridis(t)).reverse();
      break;
    case 'cividis':
      vis.meanColorScheme = range.map((t) => d3.interpolateCividis(t)).reverse();
      break;
    case 'warm':
      vis.meanColorScheme = range.map((t) => d3.interpolateWarm(t)).reverse();
      break;
    case 'cool':
      vis.meanColorScheme = range.map((t) => d3.interpolateCool(t)).reverse();
      break;
    case 'plasma':
      vis.meanColorScheme = range.map((t) => d3.interpolatePlasma(t)).reverse();
      break;
    case 'inferno':
      vis.meanColorScheme = range.map((t) => d3.interpolateInferno(t)).reverse();
      break;
    case 'turbo':
      vis.meanColorScheme = range.map((t) => d3.interpolateTurbo(t)).reverse();
      break;
    case 'blues':
      vis.meanColorScheme = range.map((t) => d3.interpolateBlues(t));
      break;
    case 'oranges':
      vis.meanColorScheme = range.map((t) => d3.interpolateOranges(t));
      break;
    default:
      vis.meanColorScheme = range.map((t) => d3.interpolateYlOrRd(t));
      break;
  }
}

function configureScales(vis) {
  vis.meanScale = d3.scaleQuantize().domain([0, 250]).range(vis.meanColorScheme);

  if (vis.isSnr) vis.deviationSteps = vis.deviationSteps.reverse();

  vis.testScale = d3.scaleQuantize().domain([0, 200]).range(vis.deviationSteps);

  vis.logScale = d3
    .scalePow()
    .exponent(0.5)
    .domain([vis.stdMin, vis.stdMax])
    .range([vis.stdMin, vis.stdMax]);

  vis.meanIntervals = vis.meanScale.range().map((value) => vis.meanScale.invertExtent(value));

  if (vis.isPow) {
    vis.deviationScale = (value) => vis.testScale(vis.logScale(value));
    vis.deviationIntervals = vis.testScale
      .range()
      .map((value) => [
        vis.logScale.invert(vis.testScale.invertExtent(value)[0]),
        vis.logScale.invert(vis.testScale.invertExtent(value)[1]),
      ]);
  } else {
    vis.deviationScale = vis.testScale;

    vis.deviationIntervals = vis.testScale
      .range()
      .map((value) => vis.testScale.invertExtent(value));
  }
}

function createBaseCell(vis) {
  return vis.chart
    .selectAll('.cell')
    .append('rect')
    .attr('width', vis.cellSize)
    .attr('height', vis.cellSize)
    .attr('fill', (d) => vis.meanScale(vis.meanAccesor(d)));
}

export function barEncode(vis, gCells) {
  const proportion = 0.6;
  const size = vis.cellSize * 0.8;
  gCells
    .append('rect')
    .attr('fill', 'transparent')
    .attr('width', vis.cellSize)
    .attr('height', vis.cellSize);

  gCells
    .append('rect')
    .attr('fill', '#1f77b4')
    .attr('width', size * proportion)
    .attr('height', (d) => vis.meanScale(vis.meanAccesor(d)))
    .attr('y', (d) => vis.cellSize - vis.meanScale(vis.meanAccesor(d)))
    .attr('x', (vis.cellSize - size) / 2);

  gCells
    .append('rect')
    .attr('fill', '#ff7f0e')
    .attr('width', size * (1 - proportion))
    .attr('height', (d) => vis.deviationScale(vis.deviationAccesor(d)))
    .attr('x', size * proportion + (vis.cellSize - size) / 2)
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
    .attr('fill', markColor)
    .attr('width', markWidth)
    .attr('height', markHeight)
    .attr('x', offsetX)
    .attr('y', offsetY)
    .attr('transform', (d) => {
      const angle = -vis.deviationScale(vis.deviationAccesor(d));
      return `rotate(${angle}, ${center}, ${center})`;
    });
}

export function encodeColorRotationCells(vis, cells) {
  const markWidth = vis.cellSize * 0.8;
  const markHeight = vis.cellSize * 0.6;
  const center = vis.cellSize / 2;
  const offsetX = (vis.cellSize - markWidth) / 2;
  const offsetY = (vis.cellSize - markHeight) / 2;

  cells
    .append('rect')
    .attr('class', 'rotationMark')
    .attr('fill', (d) => (d.mean ? vis.meanScale(vis.meanAccesor(d)) : 'black'))
    .attr('width', markWidth)
    .attr('height', markHeight)
    .attr('stroke', 'black') // Correct way to set stroke color
    .attr('stroke-width', 1)
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
    .attr('fill', markColor)
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
  const meanSteps = createLinearScale(5, vis.cellSize * 0.2, vis.cellSize * 0.9);
  let devSteps = createLinearScale(5, vis.cellSize * 0.2, vis.cellSize * 0.9);

  vis.meanScale = d3.scaleQuantize().domain([vis.meanMin, vis.meanMax]).range(meanSteps);

  if (vis.isSnr) devSteps = devSteps.reverse();

  vis.deviationScale = d3.scaleQuantize().domain([vis.stdMin, vis.stdMax]).range(devSteps);

  vis.meanIntervals = vis.meanScale.range().map((value) => vis.meanScale.invertExtent(value));
  vis.deviationIntervals = vis.deviationScale
    .range()
    .map((value) => vis.deviationScale.invertExtent(value));

  barEncode(vis, vis.chart.selectAll('.cell'));
}

function lightnessEncode(vis) {
  vis.deviationSteps = createLogScale(vis.nStds, 0.2, 1).reverse();

  configureScales(vis);

  vis.chart
    .selectAll('.cell')
    .append('rect')
    .attr('width', vis.cellSize)
    .attr('height', vis.cellSize)
    .attr('fill', 'white');

  vis.chart
    .selectAll('.cell')
    .append('rect')
    .attr('width', vis.cellSize)
    .attr('height', vis.cellSize)
    .attr('fill', (d) => vis.meanScale(vis.meanAccesor(d)))
    .attr('opacity', (d) => vis.deviationScale(vis.deviationAccesor(d)));
}

function rotationMarkEncode(vis) {
  vis.deviationSteps = createLogScale(vis.nStds);

  configureScales(vis);

  createBaseCell(vis);

  encodeRotationCells(vis, vis.chart.selectAll('.cell'));
}

function colorRotationMarkEncode(vis) {
  vis.deviationSteps = createLogScale(vis.nStds);

  configureScales(vis);

  encodeColorRotationCells(vis, vis.chart.selectAll('.cell'));
}

function markEncode(vis) {
  vis.deviationSteps = createMarkScale(vis.nStds, vis.cellSize);
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
  cellSize: sizeEncode,

  squareMark: markEncode,
  rotationMark: rotationMarkEncode,
  colorRotationMark: colorRotationMarkEncode,

  lightness: lightnessEncode,
  bars: barsEncode,
};

export function encodeCells(vis) {
  /* console.warn('encoding:', vis.encoding); */

  vis.chart.selectAll('.cell').selectAll('*').remove();

  setMeanColorScheme(vis);

  const encodingFunction = ENCODING_FUNCTIONS[vis.encoding] || simpleEncode;
  encodingFunction(vis);
}
