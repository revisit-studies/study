// Skip our global Enter handler when the focused element already handles Enter itself — multiline text entry (typing) and plain buttons/links (their own click)
function isTextEntry(el: HTMLElement): boolean {
  return el.tagName === 'TEXTAREA'
    || el.isContentEditable
    || el.closest('[contenteditable=""], [contenteditable="true"]') !== null;
}

export function shouldIgnoreEnter(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (isTextEntry(target)) {
    return true;
  }
  // except Radio.Card (<button role="radio">): its click only re-selects
  const clickable = target.closest('button, a, [role="button"]');
  return clickable !== null && clickable.getAttribute('role') !== 'radio';
}
