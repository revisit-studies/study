/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-shadow */
import { useMemo } from 'react';
import * as d3 from 'd3';

interface ComponentCountTableProps {
  componentCounts: Record<string, number>;
  componentKey: string;
  factorLevels?: Record<string, any>;
  width?: number;
  barColor?: string;
}

export function ComponentCountTable({
  componentCounts,
  componentKey,
  factorLevels = {},
}: ComponentCountTableProps) {
  // Convert object to sorted array
  const data = useMemo(
    () => Object.entries(componentCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => d3.ascending(a.name, b.name)),
    [componentCounts],
  );

  function keyMatchesLevel(
    componentKey: string,
    key: string,
    level: string,
  ): boolean {
    // Extract placeholders like ${brush}, ${question}
    const factorNames = [...componentKey.matchAll(/\$\{([^}]+)\}/g)].map(
      (m) => m[1],
    );

    // Build a regex pattern that captures each placeholder value
    let pattern = componentKey;
    for (const factorName of factorNames) {
      pattern = pattern.replace(`\${${factorName}}`, '([^_\\-]+)');
    }

    const regex = new RegExp(`^${pattern}$`);
    const match = key.match(regex);

    if (!match) return false;

    // Get all captured placeholder values
    const capturedValues = match.slice(1); // skip the full match
    return capturedValues.includes(level);
  }

  function computeNestedCounts(
    counts: Record<string, number>,
    factors: Record<string, any>,
  ) {
    // Initialize result
    const result: Record<string, Record<string, number>> = {};

    // initialize empty sub-objects for each factor
    for (const factorName of Object.keys(factors)) {
      result[factorName] = {};
      for (const level of factors[factorName].options) {
        result[factorName][level] = 0;
      }
    }

    // iterate over each full key in counts
    for (const [key, value] of Object.entries(counts)) {
      // check for matches with each factor level
      for (const [factorName, factor] of Object.entries(factors)) {
        for (const level of factor.options) {
          if (keyMatchesLevel(componentKey, key, level)) {
            result[factorName][level] += value;
          }
        }
      }
    }

    return { ...result };
  }

  const renderTable = (dataset: any) => {
    const isFlatArray = Array.isArray(dataset);

    // Convert nested object to consistent structure for rendering
    const groupedData = !isFlatArray
      ? Object.entries(dataset).map(([group, arr]) => ({
        group,
        data: Array.isArray(arr)
          ? (arr as { name: string; count: number }[])
          : Object.entries(arr as Record<string, number>).map(
            ([name, count]) => ({ name, count } as { name: string; count: number }),
          ),
      }))
      : [];

    // Setup bar chart layout
    const maxCount = isFlatArray
      ? Math.max(...dataset.map((d) => d.count))
      : Math.max(
        ...Object.entries(dataset)
          .map(([_, arr]) => (Array.isArray(arr)
            ? (arr as { name: string; count: number }[]).map((a) => a.count)
            : Object.values(arr as Record<string, number>)))
          .flat(),
      );

    const barMaxWidth = 200; // pixels
    const xScale = (count: number) => (count / maxCount) * barMaxWidth;

    const barColor = '#74c0fc';

    const renderRows = (data: { name: string; count: number }[]) => data.map((d) => (
      <tr key={d.name} style={{ borderBottom: '1px solid #eee' }}>
        <td style={{ padding: '6px 8px', fontWeight: 500 }}>{d.name}</td>
        <td style={{ padding: '6px 8px', width: 80 }}>{d.count}</td>
        <td style={{ padding: '6px 8px', width: barMaxWidth + 20 }}>
          <svg width={barMaxWidth} height={18}>
            <rect
              x={0}
              y={2}
              width={xScale(d.count) ? xScale(d.count) : 0}
              height={14}
              fill={barColor}
              rx={3}
              ry={3}
            />
          </svg>
        </td>
      </tr>
    ));

    return (
      <div style={{ overflowX: 'auto' }}>
        <h3 style={{ marginBottom: 10 }}>
          {isFlatArray ? 'Combination Counts' : 'Factor Level Counts'}
        </h3>

        <table
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            maxWidth: '600px',
            fontFamily: 'sans-serif',
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
              <th style={{ padding: '4px 8px' }}>Component</th>
              <th style={{ padding: '4px 8px' }}>Count</th>
              <th style={{ padding: '4px 8px' }}>Distribution</th>
            </tr>
          </thead>

          <tbody>
            {isFlatArray
              ? renderRows(dataset)
              : groupedData.map(({ group, data }) => (
                <>
                  {/* Group Header Row */}
                  <tr key={group}>
                    <td
                      colSpan={3}
                      style={{
                        backgroundColor: '#f8f8f8',
                        fontWeight: 700,
                        padding: '8px 8px',
                        borderTop: '2px solid #ddd',
                        color: '#333',
                      }}
                    >
                      {group}
                    </td>
                  </tr>
                  {renderRows(data)}
                </>
              ))}
          </tbody>
        </table>
      </div>
    );
  };

  const nestedCounts = computeNestedCounts(componentCounts, factorLevels);

  return Object.keys(factorLevels).length === 0
    ? renderTable(data)
    : renderTable(nestedCounts);
}
