import { ComponentBlock } from '../../parser/types';

export type TraversedSequence = { component: string | ComponentBlock, depth: number, start: number, width: number, active: boolean, id: string }

export type Arrows = { topDepth: number, x1: number, x2: number}
