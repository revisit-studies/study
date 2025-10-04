export interface ProgressHeatmapProps{
    total:number;
    answered:number;
}

export function ProgressHeatmap({ total, answered }: ProgressHeatmapProps) {
  // Only render if total is a valid number and greater than 0
  if (!total || total <= 0 || Number.isNaN(total)) {
    return null;
  }

  const createCircles = () => {
    const circles = [];
    for (let i = 0; i < total; i += 1) {
      circles.push(
        <circle
          key={i}
          cx={`${25 + i * 30}`}
          cy="50"
          r="10"
          stroke="black"
          strokeWidth="2"
          fill={i < answered ? 'green' : 'grey'}
        />,
      );
    }
    return circles;
  };

  const styles = `
      .progress-heatmap {
        display: inline-block;
        overflow-x: auto;
        overflow-y: hidden;
        min-width: 200px;
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
        <svg width={25 + total * 30 + 25} height="100">
          {createCircles()}
        </svg>
      </div>
    </>
  );
}
