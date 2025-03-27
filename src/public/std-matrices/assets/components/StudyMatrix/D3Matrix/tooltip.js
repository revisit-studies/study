import * as d3 from 'd3';
import { removeHighlight } from './highlight';

function getDeviationInterval(vis, num) {
  const interval = vis.deviationIntervals?.find(([start, end]) => num >= start && num <= end) || null;
  return interval ? interval.map((d) => d.toFixed(0)) : null;
}

function computeTooltipPosition(vis, cell, rect) {
  const distance = vis.cellSize;

  const pos = cell.node().getCTM();
  const boundingRect = vis.chart.node().getCTM();

  const centerX = pos.e + vis.cellSize / 2;
  const centerY = pos.f + vis.cellSize / 2;

  const spaceLeft = centerX - boundingRect.e;
  const spaceRight = boundingRect.e + vis.squareSize - centerX;
  const spaceTop = centerY - boundingRect.f;
  const spaceBottom = boundingRect.f + vis.squareSize - centerY;

  if (spaceRight >= spaceLeft && spaceBottom >= spaceTop) {
    return [pos.e + vis.cellSize + distance, pos.f + vis.cellSize + distance]; // SE
  }
  if (spaceRight >= spaceLeft && spaceTop > spaceBottom) {
    return [pos.e + vis.cellSize + distance, pos.f - rect.height - distance]; // NE
  }
  if (spaceLeft > spaceRight && spaceBottom >= spaceTop) {
    return [pos.e - rect.width - distance, pos.f + vis.cellSize + distance]; // SO
  }
  return [pos.e - rect.width - distance, pos.f - rect.height - distance]; // NO
}

function getTooltipText(vis, d, totalFlights, interval) {
  return `
      ${vis.originAccesor(d)} → ${vis.destinationAccesor(d)} <br> 
      Mean: ${vis.meanAccesor(d)} <br>
      Std: ${vis.stdAccesor(d)} <br>
      Total Flights on Q1: ${totalFlights} <br>
      Signal-to-noise: ${vis.snrAccesor(d)} <br>
      Deviation Interval: [${interval}] <br>
  `;
}

function renderAirlinesFreqHistogram(vis, width, height, data, tooltipHTML) {
  const margin = {
    top: 5,
    right: 30,
    bottom: 35,
    left: 30,
  };
  const widthChart = width - margin.right - margin.left;
  const heightChart = height - margin.top - margin.bottom;

  const html = `${tooltipHTML}<br> Week Frequency by Airline: <br>`;

  vis.tooltip.html(html);

  const freqs = vis.freqsAccesor(data);
  const airlines = vis.airlinesAccesor(data);

  const xScale = d3
    .scaleBand()
    .domain(vis.airlinesAccesor(data))
    .range([0, widthChart])
    .padding(0.2);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(freqs)])
    .range([heightChart, 0]);

  const chart = vis.tooltip
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top} )`);

  chart
    .selectAll('rect')
    .data(airlines)
    .join('rect')
    .attr('x', (d) => xScale(d))
    .attr('y', (d, i) => yScale(freqs[i]))
    .attr('width', xScale.bandwidth())
    .attr('height', (d, i) => heightChart - yScale(freqs[i]))
    .attr('fill', 'steelblue')
    .attr('stroke', 'black')
    .attr('stroke-width', 1);

  chart.append('g').attr('transform', `translate(0, ${heightChart})`).call(d3.axisBottom(xScale));

  chart.append('g').call(d3.axisLeft(yScale)).selectAll('.domain').remove();
}

function renderFreqHistogram(vis, width, height, data, tooltipHTML) {
  const margin = {
    top: 5,
    right: 30,
    bottom: 35,
    left: 30,
  };
  const widthChart = width - margin.right - margin.left;
  const heightChart = height - margin.top - margin.bottom;

  /* const html = `${tooltipHTML}<br> Price d: <br>`; */

  vis.tooltip.html(tooltipHTML);

  const numBins = 10;

  const minFreq = d3.min(vis.meansAccesor(data));
  const maxFreq = d3.max(vis.meansAccesor(data));

  const thresholds = d3.range(minFreq, maxFreq, (maxFreq - minFreq) / numBins);

  const bin = d3
    .bin()
    .value((d) => d)
    .thresholds(thresholds);

  const bins = bin(vis.meansAccesor(data));

  const lengths = bins.map((d) => d.length);
  const maxLengths = Math.min(7, Math.max(...lengths));

  const xScale = d3
    .scaleLinear()
    .domain([d3.min(bins, (d) => d.x0), d3.max(bins, (d) => d.x1)])
    .range([0, widthChart]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (d) => d.length)])
    .range([heightChart, 0]);

  const chart = vis.tooltip
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top} )`);

  chart
    .selectAll('rect')
    .data(bins)
    .enter()
    .append('rect')
    .attr('x', (d) => xScale(d.x0))
    .attr('y', (d) => yScale(d.length))
    .attr('width', (d) => xScale(d.x1) - xScale(d.x0))
    .attr('height', (d) => heightChart - yScale(d.length))
    .attr('fill', 'steelblue')
    .attr('stroke', 'black') // Color del borde
    .attr('stroke-width', 1); // Grosor del borde

  chart.append('g').attr('transform', `translate(0, ${heightChart})`).call(d3.axisBottom(xScale));

  chart.append('g').call(d3.axisLeft(yScale).ticks(maxLengths));
}

function renderHistogram(vis, d, text) {
  const width = 300;
  const height = 200;

  if (vis.tooltipHistogram === 'frequencies') renderAirlinesFreqHistogram(vis, width, height, d, text);
  else renderFreqHistogram(vis, width, height, d, text);
}

export function onCellMouseOver(vis, d, cellElement) {
  const num = vis.deviationAccesor(d);
  const interval = getDeviationInterval(vis, num);
  const totalFlights = d.nFlights.reduce((acc, n) => acc + n, 0);

  const tooltipText = getTooltipText(vis, d, totalFlights, interval);
  const cell = d3.select(cellElement);
  const rect = vis.tooltip.node().getBoundingClientRect();
  const [x, y] = computeTooltipPosition(vis, cell, rect);

  vis.tooltip.style('visibility', 'visible').style('left', `${x}px`).style('top', `${y}px`);

  renderHistogram(vis, d, tooltipText);
}

export function onCellMouseOut(vis) {
  vis.tooltip.style('visibility', 'hidden');
  removeHighlight(vis);
}
