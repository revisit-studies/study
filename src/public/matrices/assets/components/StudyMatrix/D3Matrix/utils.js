export function getMaxMin(array) {
  const max = Math.max(...array);
  const min = Math.min(...array);
  return [min, max];
}

export function invertScaleBand(scale, value) {
  const domain = scale.domain();
  const range = scale.range();

  const index = Math.floor((value - range[0]) / scale.step());
  return domain[Math.max(0, Math.min(index, domain.length - 1))];
}
