import * as d3 from 'd3';
import { initProvenance } from './trrack';
import { onCellMouseOut, onCellMouseOver } from './tooltip';
import {
  showHighlight,
  removeHighlight,
  highlight,
  updateHorizontal,
  updateOrder,
} from './highlight';
import { renderColorLegends, renderBarsLegend, renderLightnessLegend } from './legends';
import { encodeCells } from './encodings';
import { renderAxis } from './axis';
import { getMaxMin, invertScaleBand } from './utils';
import { applyNodeOrder, applyOrders, clusterMatrix } from './ordering';

function getDynamicMargins() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  return {
    top: height * 0.12,
    right: width * 0.08,
    bottom: height * 0.01,
    left: width * 0.1,
  };
}

class D3Matrix {
  constructor(parent, data, parameters, setAnswer) {
    this.parent = parent;
    this.data = data;
    this.svg = d3.select(parent);

    const { actions, trrack } = initProvenance(setAnswer);

    Object.assign(this, {
      parent,
      legendCellSize: 70,
      barsProportion: 0.6,
      snrLimit: 5,
      highlightedDestinations: [],
      orderNode: null,
      ...parameters,
    });

    this.margin = getDynamicMargins();
    this.axisColor = parameters.axisColor ? parameters.axisColor : 'black';

    this.trrack = trrack;
    this.actions = actions;

    this.originAccesor = (d) => d.origin;
    this.destinationAccesor = (d) => d.destination;
    this.meanAccesor = (d) => d.mean.toFixed(2);
    this.stdAccesor = (d) => d.std.toFixed(2);
    this.snrAccesor = (d) => Math.min(this.snrLimit, d.std === 0 ? this.snrLimit : (d.mean / d.std).toFixed(2));
    this.airlinesAccesor = (d) => d.airlines;
    this.freqsAccesor = (d) => d.freqs;
    this.meansAccesor = (d) => d.allMeans;
    this.nFlightsAccesor = (d) => d.nFlights;
    this.totalFlightsAccesor = (d) => d.nTotalFlights;

    this.initVis();
  }

  initVis() {
    this.tooltip = d3.select('#matrix-tooltip');

    this.chart = this.svg.append('g');
    this.horizontalHighlightsGroup = this.chart
      .append('g')
      .attr('class', 'horizontal-highlights-group');
    this.background = this.chart
      .append('rect')
      .attr('class', 'background')
      .attr('fill', 'transparent');

    this.legend = this.svg.append('g');

    this.xAxisG = this.chart.append('g').attr('class', 'x-axis');
    this.yAxisG = this.chart.append('g').attr('class', 'y-axis');

    const dimensions = this.parent.getBoundingClientRect();
    this.setSizes(dimensions);

    d3.select('#clear-selection').on('click', () => {
      this.yAxisG.selectAll('.tick text').classed('answer-selected', false);
      this.trrack.apply('Set Nodes', this.actions.setNodes([]));
    });

    d3.select('#clear-highlights').on('click', () => {
      this.highlightedDestinations = [];
      this.horizontalHighlightsGroup.selectAll('.horizontal-highlight').remove();
      this.xAxisG.selectAll('.tick text').classed('selected', false);
      this.trrack.apply('Clear Highlights', this.actions.setHoriztonalHighlightNodes([]));
    });

    d3.select('#mean-optimal-clustering').on('click', () => {
      clusterMatrix(this, 'optimal', 'mean');
      this.updateVis();
      // this.trrack.apply('Set Nodes', this.actions.setNodes([]));
    });

    d3.select('#mean-pca-clustering').on('click', () => {
      clusterMatrix(this, 'pca', 'mean');
      this.updateVis();
      // this.trrack.apply('Set Nodes', this.actions.setNodes([]));
    });

    d3.select('#std-optimal-clustering').on('click', () => {
      clusterMatrix(this, 'optimal', 'std');
      this.updateVis();
      // this.trrack.apply('Set Nodes', this.actions.setNodes([]));
    });

    d3.select('#std-pca-clustering').on('click', () => {
      clusterMatrix(this, 'pca', 'std');
      this.updateVis();
      // this.trrack.apply('Set Nodes', this.actions.setNodes([]));
    });

    d3.select('#snr-optimal-clustering').on('click', () => {
      clusterMatrix(this, 'optimal', 'snr');
      this.updateVis();
      // this.trrack.apply('Set Nodes', this.actions.setNodes([]));
    });

    d3.select('#snr-pca-clustering').on('click', () => {
      clusterMatrix(this, 'pca', 'snr');
      this.updateVis();
      // this.trrack.apply('Set Nodes', this.actions.setNodes([]));
    });

    d3.select('#reset').on('click', () => {
      this.orderNode = null;
      if (this.isCluster) {
        clusterMatrix(this, this.cluster[0], this.cluster[1]);
        this.updateVis();
      } else {
        const defaultOrder = this.data.map(this.originAccesor).sort();
        applyOrders(this, defaultOrder, defaultOrder);
        this.updateVis();
      }
      // this.trrack.apply('Set Nodes', this.actions.setNodes([]));
    });
  }

  setSizes(dimensions) {
    this.margin = getDynamicMargins();
    const { width, height } = dimensions;
    this.width = width - this.margin.left - this.margin.right;
    this.height = height - this.margin.top - this.margin.bottom;
    this.squareSize = Math.min(this.width, this.height);

    this.chart.attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

    d3.select('#buttons-div')
      .style('left', `${this.margin.left + this.squareSize + 50}px`)
      .style('top', `${this.margin.top}px`);

    this.legend.attr(
      'transform',
      `translate(${this.margin.left + this.squareSize + 100}, ${this.squareSize / 2})`,
    );
    this.background.attr('width', this.squareSize).attr('height', this.squareSize);
  }

  onResize(dimensions) {
    this.setSizes(dimensions);
    this.updateVis();
  }

  updateVis() {
    const {
      data, isSnr, snrAccesor, stdAccesor, meanAccesor, originAccesor, squareSize,
    } = this;
    this.deviationAccesor = isSnr ? snrAccesor : stdAccesor;

    const means = data.map(meanAccesor);
    const deviations = data.map(this.deviationAccesor);

    [this.meanMin, this.meanMax] = getMaxMin(means);
    [this.stdMin, this.stdMax] = getMaxMin(deviations);

    /* console.warn(`mean range: [${this.meanMin}, ${this.meanMax}]`);
    console.warn(`deviation range: [${this.stdMin}, ${this.stdMax}]`);
    console.warn(`using SNR: ${isSnr}`); */

    if (this.cluster && !this.orderNode) clusterMatrix(this, this.cluster[0], this.cluster[1]);
    const nodes = data.map(originAccesor).sort();
    const xNodes = this.xNodes ? this.xNodes : nodes;
    const yNodes = this.xNodes ? this.yNodes : nodes;

    // Definir las escalas
    this.xScale = d3.scaleBand().range([0, squareSize]).domain(xNodes);
    this.yScale = d3.scaleBand().range([0, squareSize]).domain(yNodes);

    this.cellSize = this.xScale.bandwidth();

    this.renderVis();
  }

  renderVis() {
    this.cells = this.chart
      .selectAll('.cell')
      .data(this.data)
      .join('g')
      .attr('class', 'cell')
      .attr(
        'transform',
        (d) => `translate(${this.xScale(this.originAccesor(d))}, ${this.yScale(
          this.destinationAccesor(d),
        )})`,
      );

    this.addCellListeners();
    this.addBackgroundListeners();
    encodeCells(this);

    this.renderLegend();

    renderAxis(this);

    updateHorizontal(this);
    updateOrder(this);
  }

  addCellListeners() {
    this.chart
      .selectAll('.cell')
      .on('mouseover', (e, d) => {
        this.showTooltip && onCellMouseOver(this, d, e.currentTarget);
        showHighlight(this, d);
      })
      .on('mousemove', () => {})
      .on('mouseout', () => {
        onCellMouseOut(this);
      });
  }

  addBackgroundListeners() {
    this.chart
      .selectAll('.background')
      .on('mousemove', (e) => {
        const [x, y] = d3.pointer(e);

        const origin = invertScaleBand(this.xScale, x + e.movementX);
        const destination = invertScaleBand(this.yScale, y + e.movementY);

        const link = { origin, destination };

        showHighlight(this, link);
      })
      .on('mouseleave', () => {
        removeHighlight(this);
      });
  }

  // trrack simulation methods:
  selectNodes(selectedNodes) {
    this.yAxisG
      .selectAll('.tick text')
      .classed('answer-selected', (d) => selectedNodes.includes(d));
  }

  orderByNode(node) {
    this.orderNode = node;
    applyNodeOrder(this);
    this.updateVis();
  }

  renderLegend() {
    this.legend.selectAll('*').remove();
    if (this.encoding === 'bars') renderBarsLegend(this);
    else if (this.encoding === 'lightness') renderLightnessLegend(this);
    else renderColorLegends(this);
  }

  highlightLinks(data) {
    highlight(this, data);
  }

  highlightDestinations(data) {
    const destinations = this.data
      .filter((link) => data.includes(link.origin))
      .map((link) => link.destination);
    this.highlightedDestinations = destinations;
    updateHorizontal(this);
  }
}

export default D3Matrix;
