import { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { TaskProvenanceNodes } from './TaskProvenanceNodes';
import type { EventType, StoredProvenance } from '../../store/types';
import { PROVENANCE_LOCATIONS } from '../../store/provenance';
import { getRecordingEventShortLabel } from '../../utils/recordingEvents';

type ActivityEvent = { event: EventType; label: string };

function formatTimelineTimestamp(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  const hours = Math.floor(totalMinutes / 60);
  return `${hours > 0 ? `${String(hours).padStart(2, '0')}:` : ''}${minutes}:${seconds}`;
}

export function TaskProvenanceTimeline({
  xScale,
  provenanceGraph,
  activityEvents = [],
  width,
  height,
  currentNode,
  trialName,
  startTime,
  margin,
}: {
  xScale: d3.ScaleLinear<number, number>;
  provenanceGraph: StoredProvenance | null;
  activityEvents?: ActivityEvent[];
  width: number;
  height: number;
  currentNode: string | null;
  trialName: string;
  startTime: number;
  margin: { left: number; right: number; top: number; bottom: number };
}) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number } | null>(null);
  const newXScale = useMemo(
    () => xScale
      .copy()
      .range([0, width])
      .domain([
        startTime + xScale.domain()[0] * 1000,
        startTime + xScale.domain()[1] * 1000,
      ]),
    [startTime, width, xScale],
  );

  const provenanceNodes = useMemo(
    () => (provenanceGraph ? PROVENANCE_LOCATIONS.map((provenanceArea) => {
      const graph = provenanceGraph[provenanceArea];
      if (graph) {
        return (
          <TaskProvenanceNodes
            key={`${trialName}-${provenanceArea}`}
            height={height}
            currentNode={currentNode}
            xScale={newXScale}
            provenance={graph}
          />
        );
      }
      return null;
    }) : []),
    [currentNode, height, provenanceGraph, trialName, newXScale],
  );

  return (
    <div
      data-testid="task-activity-playback-timeline"
      style={{
        width, height, marginLeft: margin.left, position: 'relative', zIndex: 10001, pointerEvents: 'none',
      }}
    >
      <svg width={width} height={height} style={{ display: 'block' }}>
        <line data-testid="task-provenance-baseline" stroke="var(--mantine-color-dimmed)" strokeWidth={1} x1={0} x2={width} y1={height / 2} y2={height / 2} />
        {provenanceNodes}
        {activityEvents.map(({ event }, index) => {
          const label = getRecordingEventShortLabel(event);
          if (!label) return null;
          const timestamp = formatTimelineTimestamp(Math.max(0, event[0] - startTime));
          const x = newXScale(event[0]);
          const tooltipText = `${label} · ${timestamp}`;
          return (
            <circle
              key={`${event[0]}-${event[1]}-${index}`}
              cx={x}
              cy={height / 2}
              r={4}
              fill={event[1] === 'studyactivity' ? 'var(--mantine-color-orange-filled)' : 'var(--mantine-color-violet-filled)'}
              stroke="var(--mantine-color-body)"
              strokeWidth={1.5}
              tabIndex={0}
              role="img"
              aria-label={tooltipText}
              pointerEvents="auto"
              data-testid="task-activity-playback-marker"
              onMouseEnter={() => setTooltip({ text: tooltipText, x })}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => setTooltip({ text: tooltipText, x })}
              onBlur={() => setTooltip(null)}
            >
              <title>{tooltipText}</title>
            </circle>
          );
        })}
      </svg>
      {tooltip && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: height + 2,
            left: Math.min(Math.max(tooltip.x - 80, 0), Math.max(0, width - 160)),
            zIndex: 10002,
            padding: '4px 8px',
            borderRadius: 4,
            background: 'var(--mantine-color-dark-9)',
            color: 'var(--mantine-color-white)',
            fontSize: 12,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
