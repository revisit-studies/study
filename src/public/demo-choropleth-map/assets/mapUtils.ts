import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology } from 'topojson-specification';
import mapData from './states-albers-10m.json' assert { type: 'json' };
import type { CsvRow, USObjectData, SvgSelection } from './types';

const MAP_WIDTH = 650;
const MAP_HEIGHT = 600;

const STROKE_DEFAULT = '#FFFFFF';
const STROKE_SELECTED = '#FF0000';
const STROKE_HOVERED = '#000000';
const STROKE_WIDTH = 2;

export function buildColorScale(
  domain: [number, number],
): d3.ScaleSequential<string> {
  return d3.scaleSequential(domain, d3.interpolateBlues);
}

export function initSvg(svgElement: SVGSVGElement): SvgSelection {
  return d3
    .select(svgElement)
    .attr('width', MAP_WIDTH)
    .attr('height', MAP_HEIGHT)
    .attr('viewBox', [0, 0, MAP_WIDTH, MAP_HEIGHT]);
}

export function drawMap(
  svg: SvgSelection,
  data: CsvRow[],
  colorScale: d3.ScaleSequential<string>,
  valueField: string,
  onHoverEnter: (stateName: string) => void,
  onHoverLeave: () => void,
  onSelect: (stateName: string) => void,
): void {
  const us = mapData as unknown as Topology<USObjectData>;
  const projection = d3
    .geoIdentity()
    .fitSize([MAP_WIDTH, MAP_HEIGHT], topojson.feature(us, us.objects.states));
  const path = d3.geoPath().projection(projection);
  const statesFeature = topojson.feature(
    us,
    us.objects.states,
  ) as FeatureCollection<Geometry, { name: string }>;

  svg
    .append('g')
    .selectAll<SVGPathElement, Feature<Geometry, { name: string }>>('path')
    .data(statesFeature.features)
    .join('path')
    .attr('d', path)
    .attr('fill', (d) => {
      const row = data.find((r) => r.name === d.properties.name);
      const val = row ? parseFloat(row[valueField] ?? '') : NaN;
      return Number.isNaN(val) ? '#ccc' : colorScale(val);
    })
    .attr('stroke', STROKE_DEFAULT)
    .attr('stroke-width', STROKE_WIDTH)
    .attr('stroke-linejoin', 'round')
    .style('cursor', 'pointer')
    .attr('data-name', (d) => d.properties.name)
    .on('mouseenter', (_event, d) => {
      onHoverEnter(d.properties.name);
    })
    .on('mouseleave', () => {
      onHoverLeave();
    })
    .on('click', (_event, d) => {
      onSelect(d.properties.name);
    });
}

export function drawLegend(
  svg: SvgSelection,
  colorScale: d3.ScaleSequential<string>,
  title: string,
  domain: [number, number],
): void {
  const legendWidth = MAP_WIDTH * 0.5;
  const legendHeight = 20;
  const legendX = 20;
  const legendY = 20;

  const gradientId = 'legend-gradient';
  const defs = svg.append('defs');
  const linearGradient = defs
    .append('linearGradient')
    .attr('id', gradientId)
    .attr('x1', '0%')
    .attr('x2', '100%')
    .attr('y1', '0%')
    .attr('y2', '0%');

  const numStops = domain[1] - domain[0];
  d3.range(numStops + 1).forEach((i) => {
    const t = i / numStops;
    linearGradient
      .append('stop')
      .attr('offset', `${t * 100}%`)
      .attr('stop-color', colorScale.interpolator()(t));
  });

  const legend = svg
    .append('g')
    .attr('transform', `translate(${legendX}, ${legendY})`);

  legend
    .append('rect')
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .style('fill', `url(#${gradientId})`);

  const legendScale = d3
    .scaleLinear()
    .domain(colorScale.domain() as [number, number])
    .range([0, legendWidth]);

  const legendAxis = d3
    .axisBottom(legendScale)
    .ticks(numStops)
    .tickSize(0)
    .tickSizeOuter(0)
    .tickPadding(legendHeight + 5);

  legend
    .append('g')
    .attr('class', 'legend-axis')
    .call(legendAxis)
    .select('.domain')
    .remove();

  legend
    .append('text')
    .attr('x', 0)
    .attr('y', -5)
    .attr('font-size', '12px')
    .attr('font-weight', 'bold')
    .text(title);
}

export function applySelectedStyles(
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  selectedStates: string[],
): void {
  selectedStates.forEach((state) => {
    svg
      .selectAll(`[data-name="${state}"]`)
      .attr('stroke', STROKE_SELECTED)
      .attr('stroke-width', STROKE_WIDTH)
      .raise();
  });
}

export function applyHoverStyles(
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  hoveredState: string,
  selectedStates: string[],
): void {
  svg
    .selectAll('path')
    .filter(function filterUnselectedStates() {
      const name = d3.select(this).attr('data-name');
      return !selectedStates.includes(name);
    })
    .attr('stroke', STROKE_DEFAULT)
    .attr('stroke-width', STROKE_WIDTH)
    .lower();

  if (hoveredState && !selectedStates.includes(hoveredState)) {
    svg
      .selectAll(`[data-name="${hoveredState}"]`)
      .attr('stroke', STROKE_HOVERED)
      .attr('stroke-width', STROKE_WIDTH)
      .raise();
  }
}
