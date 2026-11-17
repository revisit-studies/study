export function getButtonRowSizes(optionWidths: number[], availableWidth: number, gap: number, minimumButtonWidth = 0) {
  const buttonWidth = Math.max(minimumButtonWidth, optionWidths.reduce((maximum, width) => Math.max(maximum, width), 0));
  const totalWidth = buttonWidth * optionWidths.length + gap * Math.max(0, optionWidths.length - 1);
  if (totalWidth <= availableWidth) return [optionWidths.length];

  const firstRowSize = Math.ceil(optionWidths.length / 2);
  return [firstRowSize, optionWidths.length - firstRowSize];
}
