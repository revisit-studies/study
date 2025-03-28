import * as d3 from 'd3';
import { encodeMarkCells, encodeRotationCells, encodeSizeCells } from './encodings';

// this is a mess, dont recommend you to take a look :)

const meanText = (d) => `${d[0].toFixed(0)} - ${d[1].toFixed(0)}`;

/* (d) => ((d[0] + d[1]) / 2).toFixed(0); */

function renderColorStdLegend(vis, cells) {
  vis.deviationAccesor = (d) => d[0];
  cells
    .append('rect')
    .attr('width', vis.cellSize)
    .attr('height', vis.cellSize)
    .attr('fill', 'white')
    .attr('stroke', 'black')
    .attr('stroke-width', 1);

  if (vis.encoding === 'squareMark') {
    encodeMarkCells(vis, cells);
  } else if (vis.encoding === 'rotationMark') {
    encodeRotationCells(vis, cells);
  } else if (vis.encoding === 'cellSize') {
    cells.selectAll('rect').remove();
    const newCells = cells.append('rect').attr('fill', 'black');

    encodeSizeCells(vis, newCells);
  } else if (vis.encoding === 'lightness') {
    cells
      .append('rect')
      .attr('width', vis.cellSize)
      .attr('height', vis.cellSize)
      .attr('fill', 'black')
      .attr('opacity', (d) => vis.deviationScale(vis.deviationAccesor(d)));
  }

  vis.deviationAccesor = vis.isSnr ? vis.snrAccesor : vis.stdAccesor;
}

export function renderLightnessLegend(vis) {
  vis.legendCellSize = vis.cellSize;
  const margin = 20;

  let text = vis.legend
    .selectAll('.legendMeanText')
    .data(vis.meanIntervals)
    .join('text')
    .attr('class', 'legendMeanText')
    .attr('text-anchor', 'start')
    .text((d) => `${meanText(d)}`);

  const maxTextWidth = d3.max(vis.legend.selectAll('.legendMeanText').nodes(), (node) => node.getBBox().width);

  text.attr('x', (d, i) => i * (maxTextWidth + margin)).attr('y', -10);

  const totalMeanWidth = (maxTextWidth + margin) * vis.meanIntervals.length;

  vis.legend
    .selectAll('.meanText')
    .data([null])

    .join('text')
    .attr('class', 'meanText')
    .attr('text-anchor', 'middle')
    .attr('transform', `translate(${totalMeanWidth / 2},-40)`)
    .text('Mean Scale:');

  if (vis.isSnr) vis.deviationIntervals.reverse();
  vis.legend
    .selectAll('.legendMeanCell')
    .data(vis.meanIntervals)
    .join('g')
    .attr('class', 'legendMeanCell')
    .attr('transform', (d, i) => {
      const textX = i * (maxTextWidth + margin);
      const textWidth = text.nodes()[i].getBBox().width;
      const x = textX + textWidth / 2 - vis.legendCellSize / 2;
      const y = 0;
      return `translate(${x}, ${y})`;
    })
    .each(function (data) {
      d3.select(this)
        .selectAll('.legendStd')
        .data(vis.deviationIntervals)
        .join('rect')
        .attr('width', vis.legendCellSize)
        .attr('height', vis.legendCellSize)
        .attr('fill', vis.meanScale(data[0]))
        .attr('y', (std, i) => i * vis.cellSize)
        .attr('opacity', (d) => vis.deviationScale(d[0]));
    });

  text = vis.legend
    .selectAll('.legendStdText')
    .data(vis.deviationIntervals)
    .join('text')
    .attr('class', 'legendStdText')
    .attr('text-anchor', 'start')
    .text((d, i) => {
      if (i === 0) return 'unstable';
      if (i === vis.deviationIntervals.length - 1) return 'stable';
      return '      ';
    });

  const totalStdWidth = (maxTextWidth + margin) * vis.deviationIntervals.length;

  const leftMargin = (totalMeanWidth - totalStdWidth) / 2;

  const yMargin = vis.cellSize * vis.nStds + 50;

  vis.legend
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('transform', `translate(${totalMeanWidth / 2},${vis.legendCellSize + yMargin - 20})`)
    .text('Stability Scale:');

  text.attr('x', (d, i) => i * (maxTextWidth + margin) + leftMargin).attr('y', 2 * vis.legendCellSize + yMargin + 20);

  const cells = vis.legend
    .selectAll('.legendStdCell')
    .data(vis.deviationIntervals.reverse())
    .join('g')
    .attr('class', 'legendStdCell')
    .attr('transform', (d, i) => {
      const textX = i * (maxTextWidth + margin) + leftMargin;
      const textWidth = maxTextWidth;
      return `translate(${textX + textWidth / 2 - vis.legendCellSize / 2}, ${vis.legendCellSize + yMargin})`;
    });

  renderColorStdLegend(vis, cells);
}

export function renderColorLegends(vis) {
  vis.legendCellSize = vis.cellSize;
  const margin = 20;
  let text = vis.legend
    .selectAll('.legendMeanText')
    .data(vis.meanIntervals)
    .join('text')
    .attr('class', 'legendMeanText')
    .attr('text-anchor', 'start')
    .text((d) => meanText(d));

  let maxTextWidth = d3.max(vis.legend.selectAll('.legendMeanText').nodes(), (node) => node.getBBox().width);

  text.attr('x', (d, i) => i * (maxTextWidth + margin)).attr('y', vis.legendCellSize + 20);

  vis.legend
    .selectAll('.legendMeanCell')
    .data(vis.meanIntervals)
    .join('rect')
    .attr('class', 'legendMeanCell')
    .attr('width', vis.legendCellSize)
    .attr('height', vis.legendCellSize)
    .attr('x', (d, i) => {
      const textX = i * (maxTextWidth + margin);
      const textWidth = text.nodes()[i].getBBox().width;
      return textX + textWidth / 2 - vis.legendCellSize / 2;
    })
    .attr('y', 0)
    .attr('fill', (d) => vis.meanScale(d[0]));

  const totalMeanWidth = (maxTextWidth + margin) * vis.meanIntervals.length;
  vis.legend
    .selectAll('.meanText')
    .data([null])
    .join('text')
    .attr('class', 'meanText')
    .attr('text-anchor', 'middle')
    .attr('transform', `translate(${totalMeanWidth / 2},-20)`)
    .text('Mean Scale:');

  let stabilityText = [null];
  if (vis.encoding === 'simple') {
    vis.deviationIntervals = [];
    stabilityText = [];
  }

  text = vis.legend
    .selectAll('.legendStdText')
    .data(vis.deviationIntervals)
    .join('text')
    .attr('class', 'legendStdText')
    .attr('text-anchor', 'start')
    .text((d, i) => {
      if (i === 0) return 'unstable';
      if (i === vis.deviationIntervals.length - 1) return 'stable';
      return '      ';
    });

  maxTextWidth = d3.max(vis.legend.selectAll('.legendStdText').nodes(), (node) => node.getBBox().width);

  const totalStdWidth = (maxTextWidth + margin) * vis.deviationIntervals.length;

  const leftMargin = (totalMeanWidth - totalStdWidth) / 2;

  const yMargin = 100;

  vis.legend
    .selectAll('.stabilityText')
    .data(stabilityText)
    .join('text')
    .attr('class', 'stabilityText')
    .attr('text-anchor', 'middle')
    .attr('transform', `translate(${totalMeanWidth / 2},${vis.legendCellSize + yMargin - 20})`)
    .text('Stability Scale:');

  text.attr('x', (d, i) => i * (maxTextWidth + margin) + leftMargin).attr('y', 2 * vis.legendCellSize + yMargin + 20);

  const cells = vis.legend
    .selectAll('.legendStdCell')
    .data(vis.deviationIntervals)
    .join('g')
    .attr('class', 'legendStdCell')
    .attr('transform', (d, i) => {
      const textX = i * (maxTextWidth + margin) + leftMargin;
      const textWidth = i !== vis.deviationIntervals.length - 1 ? maxTextWidth : text.nodes()[i].getBBox().width;
      return `translate(${textX + textWidth / 2 - vis.legendCellSize / 2}, ${vis.legendCellSize + yMargin})`;
    });

  renderColorStdLegend(vis, cells);
}

export function renderBarsLegend(vis) {
  vis.legendCellSize = vis.cellSize;
  const margin = 20;

  let text = vis.legend
    .selectAll('.legendMeanText')
    .data(vis.meanIntervals)
    .join('text')
    .attr('class', 'legendMeanText')
    .attr('text-anchor', 'start')
    .text((d) => `${d[0].toFixed(0)} - ${d[1].toFixed(0)}`);

  let maxTextWidth = d3.max(vis.legend.selectAll('.legendMeanText').nodes(), (node) => node.getBBox().width);

  text.attr('x', (d, i) => i * (maxTextWidth + margin)).attr('y', vis.legendCellSize + 20);

  vis.legend
    .selectAll('.legendMeanCell')
    .data(vis.meanIntervals)
    .join('g')
    .attr('class', 'legendMeanCell')
    .attr('transform', (d, i) => {
      const textX = i * (maxTextWidth + margin);
      const textWidth = text.nodes()[i].getBBox().width;
      const x = textX + textWidth / 2 - vis.legendCellSize / 2;
      const y = 0;
      return `translate(${x}, ${y})`;
    })
    .each(function (d) {
      d3.select(this)
        .append('rect')
        .attr('width', vis.legendCellSize)
        .attr('height', vis.legendCellSize)
        .attr('fill', 'transparent')
        .attr('stroke', 'black')
        .attr('stroke-width', 1);
      d3.select(this)
        .append('rect')
        .attr('fill', '#1f77b4')
        .attr('width', vis.cellSize * vis.barsProportion)
        .attr('height', vis.meanScale(d[0]))
        .attr('y', vis.cellSize - vis.meanScale(d[0]));
    });

  text = vis.legend
    .selectAll('.legendStdText')
    .data(vis.deviationIntervals)
    .join('text')
    .attr('class', 'legendStdText')
    .attr('text-anchor', 'start')
    .text((d, i) => {
      if (i === 0) return 'stable';
      if (i === vis.deviationIntervals.length - 1) return 'unstable';
      return '      ';
    });
  const totalMeanWidth = (maxTextWidth + margin) * vis.meanIntervals.length;

  maxTextWidth = d3.max(vis.legend.selectAll('.legendStdText').nodes(), (node) => node.getBBox().width);

  vis.legend
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('transform', `translate(${totalMeanWidth / 2},-20)`)
    .text('Mean Scale:');

  const totalStdWidth = (maxTextWidth + margin) * vis.deviationIntervals.length;

  const leftMargin = (totalMeanWidth - totalStdWidth) / 2;

  const yMargin = 100;

  vis.legend
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('transform', `translate(${totalMeanWidth / 2},${vis.legendCellSize + yMargin - 20})`)
    .text('Stability Scale:');

  text.attr('x', (d, i) => i * (maxTextWidth + margin) + leftMargin).attr('y', 2 * vis.legendCellSize + yMargin + 20);
  if (vis.isSnr) vis.deviationIntervals.reverse();
  vis.legend
    .selectAll('.legendStdCell')
    .data(vis.deviationIntervals)
    .join('g')
    .attr('class', 'legendStdCell')
    .attr('transform', (d, i) => {
      const textX = i * (maxTextWidth + margin) + leftMargin;
      const textWidth = i !== 0 ? maxTextWidth : text.nodes()[i].getBBox().width;
      return `translate(${textX + textWidth / 2 - vis.legendCellSize / 2}, ${vis.legendCellSize + yMargin})`;
    })

    .each(function (d) {
      d3.select(this)
        .append('rect')
        .attr('width', vis.legendCellSize)
        .attr('height', vis.legendCellSize)
        .attr('fill', 'transparent')
        .attr('stroke', 'black')
        .attr('stroke-width', 1);
      d3.select(this)
        .append('rect')
        .attr('fill', '#ff7f0e')
        .attr('width', vis.cellSize * (1 - vis.barsProportion))
        .attr('height', vis.deviationScale(d[0]))
        .attr('x', vis.cellSize * vis.barsProportion)
        .attr('y', vis.cellSize - vis.deviationScale(d[0]));
    });
}
