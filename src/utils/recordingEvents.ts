import type { EventType } from '../store/types';

/**
 * isExtended is the non-prompting display-count signal. A false value can also
 * mean the Window Management policy blocks detection, so only a true result is
 * conclusive; all other cases stay unknown.
 */
export function getDisplayStatus(screen: { isExtended?: boolean } | undefined = (
  typeof window === 'undefined' ? undefined : window.screen as Screen & { isExtended?: boolean }
)): 'multiple' | 'unknown' {
  return screen?.isExtended === true ? 'multiple' : 'unknown';
}

export function getRecordingEventLabel(event: EventType) {
  if (event[1] === 'displaystatus') return `Display status: ${event[2]}`;
  if (event[1] === 'captureinterrupted') return 'Screen sharing stopped';
  if (event[1] !== 'studyactivity') return undefined;

  const labels = {
    'pointer-left': 'Pointer left study page',
    'pointer-entered': 'Pointer re-entered study page',
    'focus-lost': 'Study window lost focus',
    'focus-regained': 'Study window regained focus',
    hidden: 'Study page became hidden',
    visible: 'Study page became visible',
  };
  return labels[event[2]];
}

export function getRecordingEventShortLabel(event: EventType) {
  if (event[1] === 'displaystatus') {
    const labels = { single: 'Single display', multiple: 'Multiple displays', unknown: 'Display unknown' };
    return labels[event[2]];
  }
  if (event[1] === 'captureinterrupted') return 'Sharing stopped';
  if (event[1] !== 'studyactivity') return undefined;

  const labels = {
    'pointer-left': 'Pointer left',
    'pointer-entered': 'Pointer entered',
    'focus-lost': 'Focus lost',
    'focus-regained': 'Focus regained',
    hidden: 'Page hidden',
    visible: 'Page visible',
  };
  return labels[event[2]];
}
