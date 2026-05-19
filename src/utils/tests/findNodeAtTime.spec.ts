import { describe, expect, it } from 'vitest';
import { findNodeAtTime } from '../findNodeAtTime';

describe('findNodeAtTime', () => {
  const nodes: Record<
    string,
    { id: string; createdOn: number; children: string[]; parent?: string },
  > = {
    root: {
      id: 'root',
      createdOn: 100,
      children: ['a', 'b'],
    },
    a: {
      id: 'a',
      createdOn: 200,
      children: ['c'],
      parent: 'root',
    },
    b: {
      id: 'b',
      createdOn: 300,
      children: [],
      parent: 'root',
    },
    c: {
      id: 'c',
      createdOn: 400,
      children: [],
      parent: 'a',
    },
  };

  it('returns the starting node when playTime falls within its range', () => {
    // Node 'a' has createdOn=200, its child 'c' has createdOn=400
    // playTime=300 is > 200 but < 400, so it stays at 'a'
    expect(findNodeAtTime('a', 300, nodes)).toBe('a');
  });

  it('walks up to parent when playTime is before node createdOn', () => {
    // Node 'a' has createdOn=200, playTime=150 < 200, so walk up to 'root'
    // 'root' has createdOn=100, playTime=150 > 100, and root's first child 'a' has createdOn=200
    // playTime=150 < 200, so stop at 'root'
    expect(findNodeAtTime('a', 150, nodes)).toBe('root');
  });

  it('walks down to first child when playTime is after child createdOn', () => {
    // Node 'a' has createdOn=200, child 'c' has createdOn=400
    // playTime=500 > 400, so walk down to 'c'
    // 'c' has no children, so stop at 'c'
    expect(findNodeAtTime('a', 500, nodes)).toBe('c');
  });

  it('stays at root when playTime is before root createdOn', () => {
    // Root has createdOn=100, playTime=50 < 100
    // Root is a root node (no parent), so stop at 'root'
    expect(findNodeAtTime('root', 50, nodes)).toBe('root');
  });

  it('stops at root when walking up reaches a root node', () => {
    // Node 'c' has createdOn=400, playTime=150 < 400, walk up to 'a'
    // 'a' has createdOn=200, playTime=150 < 200, walk up to 'root'
    // 'root' has createdOn=100, playTime=150 > 100
    // Root's first child 'a' has createdOn=200, playTime=150 < 200, so stop at 'root'
    expect(findNodeAtTime('c', 150, nodes)).toBe('root');
  });

  it('handles leaf node with no children when playTime is after createdOn', () => {
    // Node 'b' has createdOn=300, no children
    // playTime=400 > 300, but no children to walk down to, so stay at 'b'
    expect(findNodeAtTime('b', 400, nodes)).toBe('b');
  });

  it('handles leaf node with no children when playTime is before createdOn', () => {
    // Node 'b' has createdOn=300, no children
    // playTime=250 < 300, walk up to 'root'
    // 'root' has createdOn=100, playTime=250 > 100
    // Root's first child 'a' has createdOn=200, playTime=250 > 200, walk down to 'a'
    // 'a' has createdOn=200, playTime=250 > 200, child 'c' has createdOn=400
    // playTime=250 < 400, so stop at 'a'
    expect(findNodeAtTime('b', 250, nodes)).toBe('a');
  });

  it('returns the node itself when it has no parent and no children match', () => {
    // Node 'b' has createdOn=300, no children
    // playTime=350 > 300, but no children to walk down to, so stay at 'b'
    expect(findNodeAtTime('b', 350, nodes)).toBe('b');
  });
});
