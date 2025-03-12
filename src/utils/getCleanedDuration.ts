import { EventType } from '../store/types';

export function getCleanedDuration(answer: { startTime: number; endTime: number; windowEvents: EventType[] }): number | undefined {
  const duration = answer.endTime === -1 ? undefined : answer.endTime - answer.startTime;
  const visibilityEvents = (answer.windowEvents || [])
    .filter((event) => event !== undefined)
    .filter(([_, type, __]) => type === 'visibility');
  let timeNavigatedAway = 0;
  let i = 0;
  while (i < visibilityEvents.length - 1) {
    if (visibilityEvents[i][2] === 'hidden') {
      for (let j = i + 1; j < visibilityEvents.length; j += 1) {
        if (visibilityEvents[j][2] === 'visible') {
          timeNavigatedAway += visibilityEvents[j][0] - visibilityEvents[i][0];
          i = j;
          break;
        }
      }
    }
    i += 1;
  }
  const cleanedDuration = duration ? duration - timeNavigatedAway : undefined;
  return cleanedDuration;
}
