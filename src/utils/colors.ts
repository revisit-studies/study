/** Canonical ReVISit palette for distinct categorical colors across the application. */
export const DISTINCT_COLOR_PALETTE = [
  '#F35C34', '#5CC8E7', '#2F853F', '#EF9A8B', '#8F62FF',
  '#FFBFEC', '#007D92', '#A17854', '#9FED9C', '#8D19E6',
];

function mixWithWhite(color: string, whiteAmount: number): string {
  const colorValue = color.slice(1);
  const channels = [0, 2, 4].map((start) => {
    const channel = Number.parseInt(colorValue.slice(start, start + 2), 16);
    return Math.round(channel + ((255 - channel) * whiteAmount));
  });

  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function getDistinctColorShade(colorIndex: number, shadeIndex: number, shadeCount: number): string {
  const baseColor = DISTINCT_COLOR_PALETTE[colorIndex % DISTINCT_COLOR_PALETTE.length];
  const normalizedIndex = shadeCount <= 1 ? 0.5 : shadeIndex / (shadeCount - 1);
  const whiteAmount = 0.82 - (normalizedIndex * 0.37);

  return mixWithWhite(baseColor, whiteAmount);
}
