import { Link } from './Interfaces';

export const originAccessor = (d: Link) => d.origin;
export const destinationAccessor = (d: Link) => d.destination;

const snrLimit = 5;
export const meanAccessor = (d: Link) => +d.mean.toFixed(2);
export const stdAccessor = (d: Link) => +d.std.toFixed(2);
export const snrAccessor = (d: Link) => +Math.min(snrLimit, d.std === 0 ? snrLimit : +(d.mean / d.std).toFixed(2));
