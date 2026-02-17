import { useMemo } from 'react';
import datasets from './datasets.json';

type Props = {
    height?: number
    width?: number
    parameters?: { datasetIndex?: number; permuted?: boolean }
}

/** Fisher-Yates shuffle using Math.random(). */
function permute(arr: number[]) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function Colorfield({
  width = 1000,
  height = 140,
  parameters,
}: Props) {
  const datasetIndex = parameters?.datasetIndex ?? 0;
  const isPermuted = parameters?.permuted ?? false;
  const data = datasets[datasetIndex];
  const { series, months } = data;
  const { daysPerMonth } = data.meta;

  const values = useMemo(() => {
    if (!isPermuted) return series.map((d) => d.value);

    const byMonth: number[][] = Array.from(
      { length: months.length },
      () => [],
    );
    series.forEach((d) => byMonth[d.month].push(d.value));
    return byMonth.flatMap((m) => permute(m));
  }, [isPermuted, series, months]);

  const min = Math.min(...values);
  const max = Math.max(...values);

  const colorScale = (value: number) => {
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));

    let r;
    let g;
    let b;

    if (t < 0.5) {
      const k = t / 0.5;
      r = Math.round(255 * k);
      g = Math.round(255 * k);
      b = 255;
    } else {
      const k = (t - 0.5) / 0.5;
      r = 255;
      g = Math.round(255 * (1 - k));
      b = Math.round(255 * (1 - k));
    }

    return `rgb(${r}, ${g}, ${b})`;
  };

  const stripeWidth = width / series.length;

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      {/* COLORFIELD */}
      <div
        style={{
          display: 'flex',
          width,
          height,
          border: '1px solid #333',
        }}
      >
        {values.map((d, i) => {
          const isMonthEnd = (i + 1) % daysPerMonth === 0;

          return (
            <div
              key={i}
              style={{
                width: stripeWidth,
                height: '100%',
                backgroundColor: colorScale(d),
                borderRight: isMonthEnd
                  ? '2px solid black'
                  : undefined,
                boxSizing: 'border-box',
              }}
            />
          );
        })}
      </div>

      {/* MONTH LABELS */}
      <div
        style={{
          display: 'flex',
          width,
          marginTop: 6,
          fontSize: 12,
        }}
      >
        {months.map((m) => (
          <div
            key={m.monthIndex}
            style={{
              width: daysPerMonth * stripeWidth,
              textAlign: 'center',
            }}
          >
            {m.name}
          </div>
        ))}
      </div>

      {/* LEGEND */}
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            height: 12,
            width: 220,
            background:
                            'linear-gradient(to right, rgb(0,0,255), rgb(255,255,255), rgb(255,0,0))',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            width: 220,
          }}
        >
          <span>{min.toFixed(0)}</span>
          <span>{((min + max) / 2).toFixed(0)}</span>
          <span>{max.toFixed(0)}</span>
        </div>
        <div style={{ fontSize: 11 }}>Value</div>
      </div>
    </div>
  );
}
