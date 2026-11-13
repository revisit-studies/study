export function getButtonRowSizes(optionWidths: number[], availableWidth: number, gap: number) {
  const totalWidth = optionWidths.reduce((total, width) => total + width, 0) + gap * Math.max(0, optionWidths.length - 1);
  if (totalWidth <= availableWidth) return [optionWidths.length];

  const firstRowSize = Math.ceil(optionWidths.length / 2);
  return [firstRowSize, optionWidths.length - firstRowSize];
}

export function getButtonColumnSpans(optionCount: number, rowSizes: number[]) {
  if (rowSizes.length === 1) return Array.from({ length: optionCount }, () => 1);
  const [firstRowSize, secondRowSize] = rowSizes;
  return Array.from({ length: optionCount }, (_, index) => (
    index < firstRowSize ? secondRowSize : firstRowSize
  ));
}
