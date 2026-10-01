import { useEffect, useState } from 'react';
import { getStaticAssetByPath } from '../../../utils/getStaticAsset';
import { PREFIX } from '../../../utils/Prefix';

type Point = [number, number];

const size = 300;
const padding = 20;
const plotSize = size - padding * 2;

export default function CorrelationPlot({
  datasetName,
  type,
  onClick,
}: {
  datasetName: string;
  type: 'pcp' | 'scatter';
  onClick: () => void;
}) {
  const [data, setData] = useState<Point[]>([]);

  useEffect(() => {
    let cancelled = false;
    setData([]);
    getStaticAssetByPath(`${PREFIX}incentives-corr/datasets/${datasetName}`)
      .then((text) => {
        if (cancelled || text === undefined) {
          return;
        }
        setData(text.trim().split('\n').slice(1).map((row) => (
          row.split(',').map(Number) as Point
        )));
      })
      .catch(() => {
        if (!cancelled) {
          setData([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [datasetName]);

  const leftValues = data.map(([value]) => value);
  const rightValues = data.map(([, value]) => value);
  const leftMin = Math.min(...leftValues);
  const leftRange = Math.max(...leftValues) - leftMin || 1;
  const rightMin = Math.min(...rightValues);
  const rightRange = Math.max(...rightValues) - rightMin || 1;

  return (
    <svg aria-label={`${type} correlation plot`} height={size} onClick={onClick} role="button" width={size}>
      <line x1={padding} x2={padding} y1={padding} y2={size - padding} stroke="black" />
      {type === 'scatter' && (
        <line x1={padding} x2={size - padding} y1={size - padding} y2={size - padding} stroke="black" />
      )}
      {type === 'pcp' && (
        <line x1={size - padding} x2={size - padding} y1={padding} y2={size - padding} stroke="black" />
      )}
      {data.map(([x, y], index) => {
        if (type === 'scatter') {
          return (
            <circle
              // The datasets have no row identifiers.
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              cx={padding + x * plotSize}
              cy={size - padding - y * plotSize}
              fill="black"
              r={2}
            />
          );
        }

        return (
          <line
            // The datasets have no row identifiers.
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            x1={padding}
            x2={size - padding}
            y1={padding + ((x - leftMin) / leftRange) * plotSize}
            y2={padding + ((y - rightMin) / rightRange) * plotSize}
            stroke="gray"
            strokeWidth={0.5}
          />
        );
      })}
      <rect fill="cornflowerblue" height={plotSize} opacity={0} width={plotSize} x={padding} y={padding}>
        <title>Select this visualization</title>
      </rect>
    </svg>
  );
}
