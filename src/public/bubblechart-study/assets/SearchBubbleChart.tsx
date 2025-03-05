import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import {
  Button, ComboboxItem, Group, OptionsFilter, Select,
} from '@mantine/core';
import { Registry, initializeTrrack } from '@trrack/core';
import cx from 'clsx';
import { StimulusParams } from '../../../store/types';
import classes from './SearchBubbleChart.module.css';

interface DataModel {
  [key:string]: string | DataModel[]
}

const RADIUS_ATTR = 'COSTT4_A';
const COLOR_ATTR = 'MD_EARN_WNE_P10';
const DISTANCE_ATTR = 'ADM_RATE';
const NAME_ATTR = 'INSTNM';
const MAX_DATA_NUM = 300;
const colorRange: string[] = ['#5e3c99', '#b2abd2', '#fdb863', '#e66101'];

const size = 720;
const pack = d3.pack<DataModel>()
  .size([size, size])
  .padding(5);

const margin = {
  left: 0, right: 100, top: 0, bottom: 0,
};

const optionsFilter: OptionsFilter = ({ options, search }) => {
  if (search.toLocaleLowerCase().trim() === '') {
    return [];
  }
  const filtered = (options as ComboboxItem[]).filter((option) => option.label.toLowerCase().trim().includes(search.toLowerCase().trim()));

  filtered.sort((a, b) => a.label.localeCompare(b.label));
  return filtered;
};

function formatData(inputData: DataModel[]): d3.HierarchyNode<DataModel> {
  // const bfl = inputData.length;
  // filter
  let data = inputData.filter((d) => !(Number.isNaN(+d[RADIUS_ATTR]) || Number.isNaN(+d[COLOR_ATTR]) || Number.isNaN(+d[DISTANCE_ATTR]) || +d[DISTANCE_ATTR] === 0));
  // window.ddd = data;
  // sort
  data = data.sort((a, b) => (+a[DISTANCE_ATTR]) - (+b[DISTANCE_ATTR]));
  // data = data.sort(function(a, b){return b[COLOR_ATTR] - a[COLOR_ATTR]})
  // then filter
  data = data.filter((d, i) => i < MAX_DATA_NUM);

  // const searchData = data;

  const root = d3.hierarchy<DataModel>({ children: data })
    .sum((d) => +d[RADIUS_ATTR])
    .sort((a, b) => +!a.children - +!b.children
            // || b.data[DISTANCE_ATTR] - a.data[DISTANCE_ATTR];
            || +a.data[DISTANCE_ATTR] - +b.data[DISTANCE_ATTR]);
  pack(root);

  return root;
}

function containsCaseInsensitive(mainString:string, searchString:string) {
  // Convert both strings to lowercase and check if the searchString is included
  return mainString.toLowerCase().includes(searchString.toLowerCase());
}

const MemoizedSelect = memo(Select);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SearchBubbleChart({ parameters, setAnswer, provenanceState }: StimulusParams<any, {all: {hoveredItem: DataModel, searchValue: string}}>) {
  const { data: dataPath, search: searchEnabled } = parameters;
  const ref = useRef(null);
  const [data, setData] = useState<d3.HierarchyCircularNode<DataModel> | null>(null);
  const [dataByKey, setDataByKey] = useState<{[key: string]: DataModel}>({});
  const [nodeByKey, setNodeByKey] = useState<{[key: string]: d3.HierarchyCircularNode<DataModel>}>({});

  const [hoveredItem, setHoveredItem] = useState<DataModel | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [selectedValue, setSelectedValue] = useState<string | null>('');
  const [highlightedItems, setHighlightedItems] = useState<DataModel[]>([]);

  const hoveredNode = useMemo(() => {
    if (hoveredItem) {
      const i = hoveredItem[NAME_ATTR] as string;
      return nodeByKey[i];
    }
    return null;
  }, [hoveredItem, nodeByKey]);

  useEffect(() => {
    if (provenanceState) {
      setHoveredItem(provenanceState.all.hoveredItem);
      setSearchValue(provenanceState.all.searchValue || '');
    } else {
      setHoveredItem(null);
      setSearchValue('');
    }
  }, [provenanceState]);

  // creating provenance tracking
  const { actions, trrack } = useMemo(() => {
    const reg = Registry.create();

    const hover = reg.register('hoverItem', (state, currHoveredItem: DataModel | null) => {
      state.all.hoveredItem = currHoveredItem;
      return state;
    });

    const searchInProgress = reg.register('searchInProgress', (state, currSearchValue: string | null) => {
      state.all.searchValue = currSearchValue;
      return state;
    });

    const trrackInst = initializeTrrack({
      registry: reg,
      initialState: {
        all: {
          hoveredItem: null,
          searchValue: null,
        },
      },
    });

    return {
      actions: {
        hover,
        searchInProgress,
      },
      trrack: trrackInst,
    };
  }, []);

  const searchList: string[] = useMemo(() => {
    if (data && data.children) {
      return data.children.map((d) => d.data.INSTNM as string);
    }
    return [];
  }, [data]);

  useEffect(() => {
    d3.csv(dataPath).then((unformattedData: DataModel[]) => {
      const formattedData = formatData(unformattedData) as unknown as d3.HierarchyCircularNode<DataModel>;
      setData(formattedData);

      const _dataByKey: {[key: string]: DataModel} = {};
      const _nodeByKey: {[key: string]: d3.HierarchyCircularNode<DataModel>} = {};
      formattedData.children?.forEach((a) => {
        _dataByKey[a.data[NAME_ATTR] as string] = a.data;
        _nodeByKey[a.data[NAME_ATTR] as string] = a;
      });

      setDataByKey(_dataByKey);
      setNodeByKey(_nodeByKey);
    });
  }, [dataPath]);

  useEffect(() => {
    const svg = d3.select(ref.current);

    const color = d3.scaleQuantize<string>().range(colorRange).domain([13000 ** 2, 65000 ** 2]);

    if (!data) {
      return;
    }

    const bubbles = svg.selectAll('circle')
      .data(data.descendants().slice(1))
      .enter().append('circle')
      .attr('r', (d) => d.r)
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .filter((d) => !!d.data)
      .style('fill', (d) => color((+d.data[COLOR_ATTR]) ** 2))
      .classed(classes.bubble, true);

    // Add mouse events to bubbles
    bubbles.on('mouseover', (e, d) => {
      if (d.data.children) return;
      setHoveredItem(d.data);
      trrack.apply('Hover', actions.hover(d.data));

      setAnswer({
        status: true,
        provenanceGraph: trrack.graph.backend,
        answers: {},
      });
    });

    bubbles.on('mouseout', () => {
      setHoveredItem(null);
      trrack.apply('Hover', actions.hover(null));

      setAnswer({
        status: true,
        provenanceGraph: trrack.graph.backend,
        answers: {},
      });
    });

    const legend = svg.append('g')
      .attr('text-anchor', 'end')
      .classed('legend', true);

    let currentLegendHeight = 40;
    const legendSpaceStep = 20;
    const legendTextStep = 10;

    legend.append('text')
      .attr('x', size + margin.right)
      .attr('y', currentLegendHeight)
      .attr('font-size', '0.8em')
      .text('Distance to Center: Admission Rate (%)');
    currentLegendHeight += legendTextStep + legendSpaceStep;

    legend.append('text')
      .attr('x', size + margin.right)
      .attr('y', currentLegendHeight)
      .attr('font-size', '0.8em')
      .text('Radius: Annual Cost ($)');
    currentLegendHeight += legendTextStep + legendSpaceStep;

    legend.append('text')
      .attr('x', size + margin.right)
      .attr('y', currentLegendHeight)
      .attr('font-size', '0.8em')
      .text('Color: Median of Earnings ($)');
    currentLegendHeight += legendTextStep + legendSpaceStep;

    // color legend
    const colorDomain = color.domain();
    const colorStep = (colorDomain[1] - colorDomain[0]) / 4;
    const colorValues = [
      colorDomain[0],
      colorDomain[0] + colorStep,
      colorDomain[0] + 2 * colorStep,
      colorDomain[0] + 3 * colorStep,
    ];
    const colorLegendData = colorRange.map((d, i) => {
      const obj = {
        color: d,
        start: `${Math.round(Math.sqrt(colorValues[i]) / 1000)}k`,
      };
      return obj;
    });
    const rectWidth = 40;

    const legendColorBlocks = legend.append('g').selectAll('g')
      .data(colorLegendData)
      .enter()
      .append('g')
      .attr('transform', (d, i) => `translate(${size + margin.right - (4 - i) * rectWidth},${currentLegendHeight} )`);

    legendColorBlocks.append('rect')
      .attr('width', rectWidth)
      .attr('height', 10)
      .attr('fill', (d) => d.color);
    legendColorBlocks.append('text')
      .attr('x', 10)
      .attr('y', -5)
      .attr('font-size', '0.8em')
      .text((d) => d.start);
    currentLegendHeight += 20 + legendSpaceStep;
  }, [data, trrack, setAnswer, actions]);

  useEffect(() => {
    const svg = d3.select(ref.current);
    svg.selectAll(`.${classes.bubble}`).classed(classes.bubbleSelected, false);
    const filteredBubbles = svg.selectAll(`.${classes.bubble}`).filter((d) => highlightedItems.some((f) => f[NAME_ATTR] === (d as d3.HierarchyCircularNode<DataModel>).data[NAME_ATTR]));
    filteredBubbles.classed(classes.bubbleSelected, true);
  }, [highlightedItems]);

  useEffect(() => {
    const x = searchList.filter((a) => containsCaseInsensitive(a, searchValue));
    if (selectedValue && searchValue === '') {
      setHighlightedItems([dataByKey[selectedValue]]);
    } else {
      setHighlightedItems(x.map((a) => dataByKey[a]));
    }
  }, [searchValue, dataByKey, selectedValue, searchList]);

  const handleSearchValueChange = useCallback((v: string) => {
    setSearchValue(v || '');
    trrack.apply('Search Value', actions.searchInProgress(v || ''));

    setAnswer({
      status: true,
      provenanceGraph: trrack.graph.backend,
      answers: {},
    });
  }, [trrack, setAnswer, actions]);

  return (
    <div>
      {searchEnabled && (
      <Group display="flex" align="flex-end">
        <MemoizedSelect
          searchable
          searchValue={searchValue}
          onSearchChange={handleSearchValueChange}
          filter={optionsFilter}
          onChange={setSelectedValue}
          label="Search"
          placeholder="Search for college..."
          data={searchList}
          w={400}
        />
        <Button onClick={() => { handleSearchValueChange(''); }}>Reset Search</Button>
      </Group>
      )}
      <div className={cx(classes.chartWrapper, { [classes.searching]: searchValue !== '' })} style={{ height: '720px' }}>
        <svg ref={ref} style={{ height: size + margin.top + margin.bottom, width: size + margin.left + margin.right }} />
        {hoveredNode && (
        <div
          className={classes.tooltip}
          style={{ left: hoveredNode.x, top: hoveredNode.y }}
        >
          <div><strong>{hoveredNode.data.INSTNM as string}</strong></div>
          <div>
            Admission Rate:
            {' '}
            {Math.round(+hoveredNode.data.ADM_RATE * 10000) / 100}
            %
          </div>
          <div>
            Annual Cost:
            {' '}
            $
            {hoveredNode.data.COSTT4_A as string}
          </div>
          <div>
            Median of Earnings:
            {' '}
            $
            {hoveredNode.data.MD_EARN_WNE_P10 as string}
          </div>
        </div>
        )}
      </div>
    </div>

  );
}

export default SearchBubbleChart;
