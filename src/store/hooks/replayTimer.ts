export function getNextSyntheticReplayTime(
  currentTime: number,
  lastTickTime: number,
  now: number,
  speed: number,
) {
  return currentTime + (((now - lastTickTime) * speed) / 1000);
}
