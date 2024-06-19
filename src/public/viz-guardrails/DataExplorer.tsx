/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable import/no-named-as-default */
/* eslint-disable no-shadow */
/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Loader, Group, Stack, Paper, Text, Divider, Flex, Blockquote,
} from '@mantine/core';
import {
  useEffect, useState, useMemo, useCallback,
} from 'react';
import * as d3 from 'd3';
import { Registry, initializeTrrack } from '@trrack/core';
import debounce from 'lodash.debounce';
import { StimulusParams } from '../../store/types';
import LineChart from './LineChart';
import Sidebar from './Sidebar';
import RangeSelector from './RangeSelector';
import Selector from './Selector';
import { StripPlot } from './StripPlot';
import { Help } from './Help';

export interface ChartParams {
    dataset: string,
    start_date: string,
    end_date: string,
    initial_selection: string[],
    allow_time_slider: boolean,
    allow_guardrail_selector: boolean,
    allow_selection: boolean,
    allow_help: boolean,
    caption: string,
    x_var: string,
    y_var: string,
    cat_var: string,
    group_var: string,
    guardrail: string
}

export function DataExplorer({ parameters, setAnswer }: StimulusParams<ChartParams>) {
  // ---------------------------- Setup & data ----------------------------
  const [data, setData] = useState<any[] | null>(null);
  const [dataname, setDataname] = useState<string>(parameters.dataset);
  const [selection, setSelection] = useState<string[] | null>(parameters.initial_selection);
  const [items, setItems] = useState<any[] | null>(null);
  const [range, setRange] = useState<[Date, Date] | null>([new Date(parameters.start_date), new Date(parameters.end_date)]);
  const [guardrail, setGuardrail] = useState<string>(parameters.guardrail);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  useEffect(() => {
    d3.csv(`./data/${dataname}.csv`)
      .then((data) => {
        setData(data);
        setItems(Array.from(new Set(data.map((row) => (JSON.stringify({
          name: row[parameters.cat_var],
          group: row[parameters.group_var],
        }))))).map((row) => JSON.parse(row)));
      });
  }, [dataname, parameters]);

  const filteredData = useMemo(() => {
    if (data && range) {
      return data
        .filter((val) => (new Date(val[parameters.x_var])).getTime() >= range[0].getTime())
        .filter((val) => (new Date(val[parameters.x_var])).getTime() <= range[1].getTime());
    }

    return null;
  }, [data, range, parameters.x_var, dataname]);

  const updateData = (data: string) => {
    setDataname(data);
    setSelection([]);
  };

  // ---------------------------- Trrack ----------------------------
  const { actions, trrack } = useMemo(() => {
    const reg = Registry.create();

    const selection = reg.register('selection', (state, currSelection: string[]) => {
      state.selection = currSelection;
      return state;
    });

    const range = reg.register('range', (state, currRange: [string, string]) => {
      state.range = currRange;
      return state;
    });

    const trrackInst = initializeTrrack({
      registry: reg,
      initialState: {
        selection: [],
        range: [parameters.start_date, parameters.end_date],
      },
    });

    return {
      actions: {
        selection,
        range,
      },
      trrack: trrackInst,
    };
  }, [parameters.end_date, parameters.start_date]);

  const trackRange = useCallback((newRange: [Date, Date]) => {
    trrack.apply('Change daterange', actions.range([newRange[0].toISOString().slice(0, 10), newRange[1].toISOString().slice(0, 10)]));
  }, [trrack, actions]);

  const debouncedTrackRange = useMemo(() => debounce(trackRange, 200), [trackRange]);

  const trackSelection = useCallback((newSelection: string[]) => {
    trrack.apply('Change selection', actions.selection(newSelection));

    setAnswer({
      status: true,
      provenanceGraph: trrack.graph.backend,
      answers: {},
    });
  }, [trrack, actions, setAnswer]);

  // ---------------------------- Render ----------------------------

  return filteredData && items && range && selection ? (
    <Stack pb={50}>
      {parameters.allow_guardrail_selector ? (
        <Paper shadow="sm" radius="md" p="md" style={{ width: '500px' }}>
          <Selector guardrail={guardrail} setGuardrail={setGuardrail} dataname={dataname} setDataname={updateData} setSelection={setSelection} />
        </Paper>
      ) : null}
      <Flex>
        <Paper shadow="md" radius="md" p="md" withBorder>
          {parameters.caption === '' ? null : (
            <Flex style={{ width: '800px' }} mb="xl">
              <Blockquote>
                {parameters.caption}
              </Blockquote>
            </Flex>
          )}
          <Group wrap="nowrap">
            {(parameters.allow_selection === false && parameters.guardrail !== 'juxt_data') ? null : (
              <Group wrap="nowrap">
                <Sidebar
                  parameters={parameters}
                  data={filteredData}
                  dataname={dataname}
                  items={items}
                  selection={selection}
                  setSelection={setSelection}
                  trackSelection={trackSelection}
                  range={range}
                  guardrail={guardrail}
                />
              </Group>
            )}
            {(parameters.allow_selection === false && parameters.guardrail !== 'juxt_data') ? null : (<Divider orientation="vertical" size="xs" />)}
            <Stack>
              <Group justify="apart">
                <Stack gap={0} justify="flex-start">
                  <Text fw={600}>
                    {dataname === 'clean_stocks' ? 'Percent change in stock price' : 'Infections per million people'}
                  </Text>
                  {guardrail === 'super_summ' ? (
                    <Text fz="xs" c="dimmed">Shaded area represents the middle 50% of all values.</Text>
                  ) : null}
                  {guardrail === 'juxt_summ' ? (
                    <Text fz="xs" c="dimmed">Bar on the left highlights the range of selection among all data.</Text>
                  ) : null}
                </Stack>
                {/* {parameters.allow_help ? <Help parameters={parameters} /> : null} */}
              </Group>
              <Stack>
                <Group wrap="nowrap">
                  {guardrail === 'juxt_summ' ? <StripPlot parameters={parameters} data={filteredData} selection={selection} dataname={dataname} /> : null}
                  <LineChart
                    parameters={parameters}
                    data={filteredData}
                    dataname={dataname}
                    items={items}
                    selection={selection}
                    range={range}
                    guardrail={guardrail}
                  />
                </Group>
                {parameters.allow_time_slider
                  ? (
                    <div style={{ width: '500px' }}>
                      <RangeSelector
                        parameters={parameters}
                        setRange={setRange}
                        trackRange={debouncedTrackRange}
                      />
                    </div>
                  ) : null }
              </Stack>
            </Stack>
          </Group>
        </Paper>
      </Flex>
    </Stack>
  ) : <Loader />;
}

export default DataExplorer;
