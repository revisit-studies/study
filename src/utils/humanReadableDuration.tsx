export function youtubeReadableDuration(msDuration: number) {
  if (Number.isNaN(msDuration as number)) {
    return undefined;
  }
  if (msDuration <= 0) {
    return '0s';
  }

  const h = Math.floor(msDuration / 1000 / 60 / 60);
  const m = Math.floor((msDuration / 1000 / 60 / 60 - h) * 60);
  const s = Math.floor(((msDuration / 1000 / 60 / 60 - h) * 60 - m) * 60);

  // To get time format 00:00:00
  const seconds: string = s < 10 ? `0${s}` : `${s}`;
  const minutes: string = m < 10 ? `0${m}` : `${m}`;
  const hours: string = h < 10 ? `0${h}` : `${h}`;

  return `${h > 0 ? `${hours}:` : ''}${`${minutes}`}:${seconds}`;
}
