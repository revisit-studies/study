import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as d3 from 'd3';
import { ComboboxItem, Select } from '@mantine/core';
import { FilterOptionsInput } from '@mantine/core/lib/components/Combobox/OptionsDropdown/default-options-filter';
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
function SearchBubbleChart({ parameters }: StimulusParams<any>) {
  const { data: dataPath } = parameters;
  const ref = useRef(null);
  const [data, setData] = useState<d3.HierarchyCircularNode<DataModel> | null>(null);
  const [dataByKey, setDataByKey] = useState<{[key: string]: DataModel}>({});

  const [hoveredItem, setHoveredItem] = useState<d3.HierarchyCircularNode<DataModel>>();
  const [searchValue, setSearchValue] = useState('');
  const [selectedValue, setSelectedValue] = useState<string | null>('');
  const [highlightedItems, setHighlightedItems] = useState<DataModel[]>([]);

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

      const byKey: {[key: string]: DataModel} = {};
      formattedData.children?.forEach((a) => {
        byKey[a.data[NAME_ATTR] as string] = a.data;
      });

      setDataByKey(byKey);
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
      // .classed('group', (d) => !!d.children)
      .filter((d) => !!d.data)
      .style('fill', (d) => color((+d.data[COLOR_ATTR]) ** 2))
      .classed(classes.bubble, true);

    // Add mouse events to bubbles
    bubbles.on('mouseover', (e, d) => {
      if (d.data.children) return;
      setHoveredItem(d);
    });

    bubbles.on('mouseout', () => {
      setHoveredItem(undefined);
    });

    const legend = svg.append('g')
      .classed('legend', true);
    let currentLegendHeight = 40;
    const legendSpaceStep = 20;
    const legendTextStep = 10;

    legend.append('text')
      .attr('x', size + margin.right)
      .attr('y', currentLegendHeight)
      .text('Distance to Center: Admission Rate (%)');
    currentLegendHeight += legendTextStep + legendSpaceStep;
  }, [data]);

  useEffect(() => {
    const svg = d3.select(ref.current);
    svg.selectAll(`.${classes.bubble}`).classed(classes.bubbleSelected, false);
    const filteredBubbles = svg.selectAll(`.${classes.bubble}`).filter((d) => highlightedItems.some((f) => f[NAME_ATTR] === (d as d3.HierarchyCircularNode<DataModel>).data[NAME_ATTR]));
    filteredBubbles.classed(classes.bubbleSelected, true);
  }, [highlightedItems]);

  const handleFilter = useCallback((filterOptionsInput: FilterOptionsInput) => {
    const x = filterOptionsInput.options.filter((a) => {
      const r = a as ComboboxItem;
      return containsCaseInsensitive(r.label, filterOptionsInput.search);
    });

    if (selectedValue && filterOptionsInput.search === '') {
      setHighlightedItems([dataByKey[selectedValue]]);
    } else {
      setHighlightedItems(x.map((a) => dataByKey[(a as ComboboxItem).value]));
    }
    return x;
  }, [dataByKey, selectedValue]);

  return (
    <div>
      <MemoizedSelect
        searchable
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onChange={setSelectedValue}
        filter={handleFilter}
        label="Search"
        placeholder="Search for college..."
        data={searchList}
      />
      <div className={cx(classes.chartWrapper, { [classes.searching]: searchValue !== '' })} style={{ height: '720px' }}>
        <svg ref={ref} style={{ height: 720, width: 720 }} />
        {hoveredItem && (
        <div
          className={classes.tooltip}
          style={{ left: hoveredItem.x, top: hoveredItem.y }}
        >
          <div>{hoveredItem.data.INSTNM as string}</div>
          <div>
            Admission Rate:
            {' '}
            {Math.round(+hoveredItem.data.ADM_RATE * 10000) / 100}
            %
          </div>
          <div>
            Annual Cost:
            {' '}
            $
            {hoveredItem.data.COSTT4_A as string}
          </div>
          <div>
            Median of Earnings:
            {' '}
            $
            {hoveredItem.data.MD_EARN_WNE_P10 as string}
          </div>
        </div>
        )}
      </div>
    </div>

  );
}

export default SearchBubbleChart;
