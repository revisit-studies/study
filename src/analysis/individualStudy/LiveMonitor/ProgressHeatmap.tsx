export interface ProgressHeatmapProps{
    total:number;
    answered:number;
    isDynamic:boolean;
}

export function ProgressHeatmap({ total, answered, isDynamic }: ProgressHeatmapProps) {
  // Only render if total is a valid number and greater than 0
  if (!total || total <= 0 || Number.isNaN(total)) {
    return null;
  }
  const totalCiercle = isDynamic ? answered : total;
  const createCircles = () => {
    const elements = [];
    for (let i = 0; i < totalCiercle; i += 1) {
      elements.push(
        <circle
          key={i}
          cx={`${25 + i * 30}`}
          cy="50"
          r="10"
          stroke="black"
          strokeWidth="2"
          fill={isDynamic ? 'teal' : (i < answered ? 'green' : 'grey')}
        />,
      );
    }

    // Add question mark when isDynamic is true
    if (isDynamic && totalCiercle > 0) {
      elements.push(
        <text
          key="question"
          x={`${25 + totalCiercle * 30}`}
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
        overflow-x: auto;
        overflow-y: hidden;
        vertical-align: top;
        width: 50%;
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
        <svg width="100%" height="100">
          {createCircles()}
        </svg>
      </div>
    </>
  );
}
