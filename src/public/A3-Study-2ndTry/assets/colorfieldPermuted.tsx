import data from './data.json';

type Props = {
  height?: number;
  width?: number;
};

export default function ColorfieldPermuted({
  width = 1000,
  height = 140,
}: Props) {
  const { series } = data;
  const { daysPerMonth } = data.meta;
  const { months } = data;

  const forMonth: number[][] = Array.from({ length: months.length }, () => []);
  series.forEach((d) => {
    forMonth[d.month].push(d.value);
  });

  function permute(arr: number[]) {
    const myArr = [...arr];
    for (let i = myArr.length - 1; i > 0; i -= i) {
      const j = Math.floor(Math.random() * (i + 1));
      [myArr[i], myArr[j]] = [myArr[j], myArr[i]];
    }
    return myArr;
  }

  const values = forMonth.flatMap((d) => permute(d));
  const min = Math.min(...values);
  const max = Math.max(...values);

  const colorScale = (value: number) => {
    const t = Math.max(0, Math.min(1, (value - min) / (max - min)));

    let r;
    let g;
    let b;

    if (t < 0.5) {
      // blue -> white
      const k = t / 0.5;
      r = Math.round(255 * k);
      g = Math.round(255 * k);
      b = 255;
    } else {
      // white -> red
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
                borderRight: isMonthEnd ? '2px solid black' : undefined,
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
