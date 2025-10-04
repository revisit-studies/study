import { Tooltip } from '@mantine/core';

export interface ProgressHeatmapProps{
    total:number;
    answered:string[];
    isDynamic:boolean;
}

export function ProgressHeatmap({ total, answered, isDynamic }: ProgressHeatmapProps) {
  // Only render if total is a valid number and greater than 0
  if (!total || total <= 0 || Number.isNaN(total)) {
    return null;
  }
  const totalCircle = isDynamic ? answered.length : total;

  const createCircles = () => {
    const elements = [];
    for (let i = 0; i < totalCircle; i += 1) {
      const tooltipLabel = i < answered.length
        ? `Question ${i + 1}: ${answered[i]}`
        : `Question ${i + 1}: Not answered`;

      elements.push(
        <Tooltip key={i} label={tooltipLabel} position="top">
          <circle
            cx={`${25 + i * 30}`}
            cy="50"
            r="10"
            stroke="black"
            strokeWidth="2"
            fill={isDynamic ? 'teal' : (i < answered.length ? 'green' : 'grey')}
            style={{ cursor: 'pointer' }}
          />
        </Tooltip>,
      );
    }

    // Add question mark when isDynamic is true
    if (isDynamic && totalCircle > 0) {
      elements.push(
        <text
          key="question"
          x={`${25 + totalCircle * 30}`}
          y="58"
          fontSize="25"
          fill="teal"
        >
          ?
        </text>,
      );
    }

    return elements;
  };

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
        <svg width={`${Math.max(100, 25 + totalCircle * 30 + (isDynamic ? 40 : 0))}`} height="100">
          {createCircles()}
        </svg>
      </div>
    </>
  );
}
