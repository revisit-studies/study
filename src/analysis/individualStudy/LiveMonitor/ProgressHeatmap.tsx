import { Tooltip } from '@mantine/core';
import { useMemo } from 'react';
import * as d3 from 'd3';

interface ProgressHeatmapProps {
  total: number;
  answered: string[];
  isDynamic: boolean;
}

const TASK_HEIGHT = 20;
const TASK_GAP = 5;
const MARGIN = {
  left: 5, right: 5, top: 10, bottom: 10,
};

const COLORS = {
  UNANSWERED: {
    FILL: 'grey',
    STROKE: '#666',
  },
  ANSWERED: {
    FILL: 'green',
    STROKE: '#166534',
  },
  DYNAMIC: {
    FILL: 'teal',
    STROKE: '#0d9488',
  },
  TEXT: 'white',
};

export function ProgressHeatmap({ total, answered, isDynamic }: ProgressHeatmapProps) {
  const totalTasks = isDynamic ? answered.length : total;

  const xScale = useMemo(() => {
    const width = Math.max(300, totalTasks * 50);
    return d3.scaleLinear()
      .domain([0, totalTasks])
      .range([MARGIN.left, width - MARGIN.right]);
  }, [totalTasks]);

  if (!total || total <= 0 || Number.isNaN(total)) {
    return null;
  }

  const createTimelineElements = () => {
    const elements = [];

    for (let i = 0; i < totalTasks; i += 1) {
      const isAnswered = i < answered.length;
      const tooltipLabel = isAnswered
        ? `Question ${i + 1}: ${answered[i]}`
        : `Question ${i + 1}: Not answered`;

      // Determine fill color based on status
      let fill = COLORS.UNANSWERED.FILL;
      let stroke = COLORS.UNANSWERED.STROKE;

      if (isDynamic) {
        fill = COLORS.DYNAMIC.FILL;
        stroke = COLORS.DYNAMIC.STROKE;
      } else if (isAnswered) {
        fill = COLORS.ANSWERED.FILL;
        stroke = COLORS.ANSWERED.STROKE;
      }

      const x = xScale(i);
      const width = xScale(i + 1) - xScale(i) - TASK_GAP;
      const rectWidth = Math.max(width, 2);

      elements.push(
        <Tooltip key={i} label={tooltipLabel} position="top" withinPortal>
          <g>
            <rect
              x={x}
              y={MARGIN.top}
              width={rectWidth}
              height={TASK_HEIGHT}
              fill={fill}
              stroke={stroke}
              strokeWidth="1.5"
              rx="3"
              style={{ cursor: 'pointer' }}
            />
            <text
              x={x + rectWidth / 2}
              y={MARGIN.top + TASK_HEIGHT / 2 + 4}
              fontSize="11"
              fontWeight="600"
              fill={COLORS.TEXT}
              textAnchor="middle"
              pointerEvents="none"
            >
              Q
              {i + 1}
            </text>
          </g>
        </Tooltip>,
      );
    }

    // Add question mark indicator for dynamic studies
    if (isDynamic && totalTasks > 0) {
      elements.push(
        <text
          key="question-mark"
          x={xScale(totalTasks) + 10}
          y={MARGIN.top + TASK_HEIGHT / 2 + 7}
          fontSize="20"
          fontWeight="bold"
          fill={COLORS.DYNAMIC.FILL}
        >
          ?
        </text>,
      );
    }

    return elements;
  };

  const svgWidth = Math.max(300, xScale(totalTasks) + (isDynamic ? 40 : MARGIN.right));
  const svgHeight = TASK_HEIGHT + MARGIN.top + MARGIN.bottom;

  const styles = `
      .progress-heatmap {
        display: inline-block;
        vertical-align: top;
        width: 50%;
        overflow-x: auto;
        overflow-y: hidden;
        white-space: nowrap;
      }
      .progress-heatmap svg {
        display: inline-block;
        vertical-align: top;
      }
      
      /* Custom scrollbar styling */
      .progress-heatmap::-webkit-scrollbar {
        height: 8px;
      }
      .progress-heatmap::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
      }
      .progress-heatmap::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 4px;
      }
      .progress-heatmap::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
      }
      
      @media (max-width: 900px) {
        .progress-heatmap {
          width: 100% !important;
          display: block;
        }
      }
    `;

  return (
    <>
      <style>{styles}</style>
      <div className="progress-heatmap">
        <svg width={svgWidth} height={svgHeight}>
          {createTimelineElements()}
        </svg>
      </div>
    </>
  );
}
