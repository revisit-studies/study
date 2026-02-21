import { useMemo } from 'react';
import { ColorSwatch, Tooltip } from '@mantine/core';
import * as d3 from 'd3';
import { TranscriptLinesWithTimes } from './types';

const margin = {
  top: 5,
  left: 5,
  right: 5,
  bottom: 5,
};

export function TranscriptSegmentsVis({
  transcriptLines, xScale, startTime, currentShownTranscription,
} : {
  transcriptLines: TranscriptLinesWithTimes[], xScale: d3.ScaleLinear<number, number>; startTime: number; currentShownTranscription: number
}) {
  const lines = useMemo(() => transcriptLines.map((line) => (
    <g key={line.start}>
      <line
        stroke={currentShownTranscription >= line.lineStart && currentShownTranscription <= line.lineEnd ? 'cornflowerblue' : 'lightgray'}
        strokeWidth={5}
        y1={margin.top}
        y2={margin.top}
        x1={xScale(startTime + line.start * 1000) + 2}
        x2={xScale(startTime + line.end * 1000) - 2}
      />
      {line.tags.map((topTags, i) => (
        <g key={i}>
          {topTags.map((tag, tagIndex) => {
            const startLoc = xScale(startTime + line.start * 1000);
            const endLoc = xScale(startTime + line.end * 1000);

            if (!tag) {
              return null;
            }

            return (
              <foreignObject key={tag.name} x={startLoc + ((endLoc - startLoc) / line.tags.length) * (i + 0.5) - 6 + (((-(topTags.length - 1) * 15) / 2) + (tagIndex) * 15)} y={15} height="20px" width="20px">
                <Tooltip label={tag.name} withArrow arrowSize={6}>
                  <ColorSwatch size={12} color={tag.color} />
                </Tooltip>
              </foreignObject>
            );
          })}
        </g>
      ))}
    </g>
  )), [currentShownTranscription, startTime, transcriptLines, xScale]);

  return (
    <svg style={{ width: '100%', height: '30px' }}>
      {lines}
    </svg>
  );
}
