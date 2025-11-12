/* eslint-disable react-hooks/exhaustive-deps */
import { useMemo } from 'react';
import { Table, Text } from '@mantine/core';
import * as d3 from 'd3';

interface Factor {
  name: string;
  options: string[];
  numSamples?: number;
  order: 'fixed' | 'random';
}

interface HeatmapProps {
  componentCounts: Record<string, number>;
  componentKey: string;
  factorLevels: Record<string, Factor>;
}

export function FactorHeatmap({
  componentCounts,
  componentKey,
  factorLevels,
}: HeatmapProps) {
  const factorX = Object.keys(factorLevels)[0];
  const factorY = Object.keys(factorLevels)[1];
  const xOptions = factorLevels[factorX]?.options ?? [];
  const yOptions = factorLevels[factorY]?.options ?? [];

  // Build matrix
  const dataMatrix = useMemo(
    () => yOptions.map((y) => xOptions.map((x) => {
      const key = componentKey
        .replace(`\${${factorX}}`, x)
        .replace(`\${${factorY}}`, y);
      return { x, y, value: componentCounts[key] ?? 0 };
    })),
    [componentCounts, xOptions, yOptions, componentKey, factorX, factorY],
  );

  // Create color scale
  const allValues = dataMatrix.flat().map((d) => d.value);
  const maxValue = Math.max(...allValues, 1);
  const colorScale = d3
    .scaleSequential(d3.interpolateBlues)
    .domain([0, maxValue * 5]);

  return (
    <Table
      highlightOnHover
      verticalSpacing="sm"
      horizontalSpacing="sm"
      style={{
        borderCollapse: 'separate', // ✅ allows spacing between cells
        borderSpacing: '6px 6px', // ✅ adds gaps between rows/cols
        width: '50%',
      }}
    >
      <thead>
        <tr>
          <th />
          {xOptions.map((x) => (
            <th key={x} style={{ textAlign: 'center', padding: '4px 6px' }}>
              <Text ta="center" fw={600}>
                {x}
              </Text>
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {yOptions.map((y, rowIndex) => (
          <tr key={y}>
            <td
              style={{
                fontWeight: 600,
                textAlign: 'right',
                fontSize: 12,
                color: '#333',
                width: 50,
                verticalAlign: 'middle',
              }}
            >
              {y}
            </td>

            {xOptions.map((x, colIndex) => {
              const { value } = dataMatrix[rowIndex][colIndex];
              const backgroundColor = colorScale(value);
              const textColor = '#222';

              return (
                <td
                  key={x}
                  style={{
                    textAlign: 'center',
                    padding: '10px 0',
                    fontSize: 12,
                    backgroundColor,
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    transition: 'background-color 0.2s, transform 0.1s',
                    boxShadow: '0 0 3px rgba(0,0,0,0.05)',
                    cursor: 'default',
                  }}
                >
                  <Text fw={600} c={textColor}>
                    {value}
                  </Text>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
