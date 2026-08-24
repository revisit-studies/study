export function getDefaultSliderSpacing(min: number, max: number) {
  const range = Math.abs(max - min);

  if (range === 0) {
    return 1;
  }

  return 10 ** (Math.ceil(Math.log10(range)) - 1);
}

// This is for handling decimal values, since toFixed() rounds the number and can cause issues with floating point precision
function getDecimalPlaces(value: number) {
  const [coefficient, exponent = '0'] = value.toString().toLowerCase().split('e');
  const coefficientDecimals = coefficient.split('.')[1]?.length ?? 0;
  return Math.max(0, coefficientDecimals - Number(exponent));
}

export function generateSliderBreakValues(min: number, max: number, spacing?: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [] as number[];
  }

  const calculatedSpacing = spacing ?? getDefaultSliderSpacing(min, max);
  if (!Number.isFinite(calculatedSpacing) || calculatedSpacing <= 0) {
    return [] as number[];
  }

  const decimalPlaces = getDecimalPlaces(calculatedSpacing);
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

export function getSliderValueFromPosition(
  position: number,
  min: number,
  max: number,
  step?: number,
  snapValues?: number[],
): number | null {
  // Validate inputs
  if (!Number.isFinite(position) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return null;
  }

  const clampedPosition = Math.min(1, Math.max(0, position));
  const rawValue = min + clampedPosition * (max - min);

  if (snapValues?.length) {
    return snapValues.reduce((closest, value) => (
      Math.abs(value - rawValue) < Math.abs(closest - rawValue) ? value : closest
    ));
  }

  const stepSize = step ?? (max - min) / 100;
  if (!Number.isFinite(stepSize) || stepSize <= 0) {
    return null;
  }

  const precision = Math.max(getDecimalPlaces(min), getDecimalPlaces(stepSize));
  // Round to the nearest valid step
  const steppedValue = Math.round((rawValue - min) / stepSize) * stepSize + min;
  const normalizedValue = Number(steppedValue.toFixed(precision));
  // Clamp the normalized result to the configured range
  return Math.min(max, Math.max(min, normalizedValue));
}
