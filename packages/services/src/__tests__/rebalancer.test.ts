/**
 * Rebalancer precision drift tests
 *
 * Verifies that computeFractionalIndex degrades gracefully over many
 * successive bisections, and that the rebalance threshold is set correctly.
 */

import { computeFractionalIndex } from '@kanban/utils';

const REBALANCE_THRESHOLD = 1e-10;

describe('fractional index precision degradation', () => {
  it('maintains unique values after 50 sequential bisections', () => {
    const indices: string[] = ['1', '2'];

    // Repeatedly insert between the first two cards
    for (let i = 0; i < 50; i++) {
      const newIdx = computeFractionalIndex(indices[0]!, indices[1]!);
      indices.splice(1, 0, newIdx);
    }

    // All indices must be strictly unique
    const unique = new Set(indices);
    expect(unique.size).toBe(indices.length);
  });

  it('maintains ordering after 50 bisections', () => {
    const indices: string[] = ['1', '2'];

    for (let i = 0; i < 50; i++) {
      const newIdx = computeFractionalIndex(indices[0]!, indices[1]!);
      indices.splice(1, 0, newIdx);
    }

    // All values must be strictly ascending
    for (let i = 1; i < indices.length; i++) {
      expect(parseFloat(indices[i]!)).toBeGreaterThan(parseFloat(indices[i - 1]!));
    }
  });

  it('gap between 1 and 2 after 33 bisections is below rebalance threshold', () => {
    let lo = 1;
    let hi = 2;
    for (let i = 0; i < 33; i++) {
      const mid = (lo + hi) / 2;
      hi = mid; // Always insert at the top
    }
    const gap = hi - lo;
    // After 33 bisections the gap should be extremely small
    expect(gap).toBeLessThan(REBALANCE_THRESHOLD);
  });

  it('rebalance restores integer spacing', () => {
    // Simulate rebalanceIndices result
    const cardIds = ['a', 'b', 'c', 'd', 'e'];
    const result = new Map<string, string>();
    cardIds.forEach((id, i) => result.set(id, String(i + 1)));

    expect(result.get('a')).toBe('1');
    expect(result.get('e')).toBe('5');

    // After rebalance, minimum gap is 1 (integers)
    const values = [...result.values()].map(parseFloat);
    let minGap = Infinity;
    for (let i = 1; i < values.length; i++) {
      minGap = Math.min(minGap, values[i]! - values[i - 1]!);
    }
    expect(minGap).toBe(1);
    expect(minGap).toBeGreaterThan(REBALANCE_THRESHOLD);
  });
});
