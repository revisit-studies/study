export function getButtonRowSizes(optionWidths: number[], availableWidth: number, gap: number, minimumButtonWidth = 0) {
  const buttonWidth = Math.max(minimumButtonWidth, optionWidths.reduce((maximum, width) => Math.max(maximum, width), 0));
  const columns = Math.max(1, Math.floor((availableWidth + gap) / (buttonWidth + gap)));
  const rowSizes = [];
  for (let remaining = optionWidths.length; remaining > 0; remaining -= columns) {
    rowSizes.push(Math.min(columns, remaining));
  }
  return rowSizes;
}
