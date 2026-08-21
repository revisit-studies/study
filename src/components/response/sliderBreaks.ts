export function getDefaultSliderSpacing(min: number, max: number) {
  const range = Math.abs(max - min);

  if (range === 0) {
    return 1;
  }

  return 10 ** (Math.ceil(Math.log10(range)) - 1);
}

export function generateSliderBreakValues(min: number, max: number, spacing?: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [] as number[];
  }

  const calculatedSpacing = spacing ?? getDefaultSliderSpacing(min, max);
  if (!Number.isFinite(calculatedSpacing) || calculatedSpacing <= 0) {
    return [] as number[];
  }

  const spacingString = calculatedSpacing.toString();
  const decimalPlaces = spacingString.includes('e-')
    ? Number(spacingString.split('e-')[1])
    : (spacingString.split('.')[1]?.length ?? 0);
  const normalize = (value: number) => Number(value.toFixed(decimalPlaces));
  const epsilon = Math.abs(calculatedSpacing) / 1_000_000;
  const firstIndex = Math.ceil((min + epsilon) / calculatedSpacing);
  const lastIndex = Math.floor((max - epsilon) / calculatedSpacing);
  const labels: number[] = [];

  for (let idx = firstIndex; idx <= lastIndex; idx += 1) {
    const value = normalize(idx * calculatedSpacing);
    if (value > min + epsilon && value < max - epsilon) {
      labels.push(value);
    }
  }

  return labels;
}
