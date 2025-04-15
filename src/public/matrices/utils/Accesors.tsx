import { link } from './Interfaces';

export const originAccesor = (d: link) => d.origin;
export const destinationAccesor = (d: link) => d.destination;

const snrLimit = 5;
export const meanAccesor = (d: link) => +d.mean.toFixed(2);
export const stdAccesor = (d: link) => +d.std.toFixed(2);
export const snrAccesor = (d: link) => +Math.min(snrLimit, d.std === 0 ? snrLimit : +(d.mean / d.std).toFixed(2));
