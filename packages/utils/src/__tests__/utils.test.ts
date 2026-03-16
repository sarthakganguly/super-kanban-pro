/**
 * Unit tests for @kanban/utils
 *
 * Tests cover the fractional indexing algorithm — the most critical logic
 * in the app since incorrect indices corrupt card ordering irreversibly.
 */

import {
  chunk,
  computeFractionalIndex,
  extractHashtags,
  isColorDark,
  isOverdue,
  normalizeTag,
  rebalanceIndices,
  sortByPosition,
} from '../index';

// ---------------------------------------------------------------------------
// computeFractionalIndex
// ---------------------------------------------------------------------------

describe('computeFractionalIndex', () => {
  it('returns "1" when both prev and next are null (first card)', () => {
    expect(computeFractionalIndex(null, null)).toBe('1');
  });

  it('inserts between two indices: midpoint of 1 and 3 = 2', () => {
    expect(computeFractionalIndex('1', '3')).toBe('2');
  });

  it('inserts between adjacent indices: 1 and 2 = 1.5', () => {
    expect(computeFractionalIndex('1', '2')).toBe('1.5');
  });

  it('inserts at start (prev null): between 0 and next', () => {
    const result = computeFractionalIndex(null, '1');
    const num = parseFloat(result);
    expect(num).toBeGreaterThan(0);
    expect(num).toBeLessThan(1);
  });

  it('inserts at end (next null): greater than prev', () => {
    const result = computeFractionalIndex('5', null);
    expect(parseFloat(result)).toBeGreaterThan(5);
  });

  it('supports deep nesting: 1.5 and 2 → 1.75', () => {
    expect(computeFractionalIndex('1.5', '2')).toBe('1.75');
  });

  it('produced indices maintain strict ordering after multiple insertions', () => {
    // Simulate inserting 5 cards in sequence
    const indices: string[] = [];
    let prev: string | null = null;
    for (let i = 0; i < 5; i++) {
      const idx = computeFractionalIndex(prev, null);
      indices.push(idx);
      prev = idx;
    }
    // Each index must be strictly greater than the previous
    for (let i = 1; i < indices.length; i++) {
      expect(parseFloat(indices[i]!)).toBeGreaterThan(parseFloat(indices[i - 1]!));
    }
  });

  it('handles inserting between very close values without collision', () => {
    const a = computeFractionalIndex('1', '1.000001');
    const aNum = parseFloat(a);
    expect(aNum).toBeGreaterThan(1);
    expect(aNum).toBeLessThan(1.000001);
  });
});

// ---------------------------------------------------------------------------
// rebalanceIndices
// ---------------------------------------------------------------------------

describe('rebalanceIndices', () => {
  it('assigns sequential integer indices starting at 1', () => {
    const map = rebalanceIndices(['a', 'b', 'c']);
    expect(map.get('a')).toBe('1');
    expect(map.get('b')).toBe('2');
    expect(map.get('c')).toBe('3');
  });

  it('handles empty array', () => {
    expect(rebalanceIndices([])).toEqual(new Map());
  });
});

// ---------------------------------------------------------------------------
// sortByPosition
// ---------------------------------------------------------------------------

describe('sortByPosition', () => {
  it('sorts items by numeric value of positionIndex ascending', () => {
    const cards = [
      { id: 'c', positionIndex: '3' },
      { id: 'a', positionIndex: '1' },
      { id: 'b', positionIndex: '1.5' },
    ];
    const sorted = sortByPosition(cards);
    expect(sorted.map(c => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the original array', () => {
    const original = [
      { positionIndex: '2' },
      { positionIndex: '1' },
    ];
    sortByPosition(original);
    expect(original[0]!.positionIndex).toBe('2');
  });
});

// ---------------------------------------------------------------------------
// normalizeTag / extractHashtags
// ---------------------------------------------------------------------------

describe('normalizeTag', () => {
  it('strips leading # and lowercases', () => {
    expect(normalizeTag('#Feature')).toBe('feature');
    expect(normalizeTag('  #BUG  ')).toBe('bug');
  });

  it('handles input without #', () => {
    expect(normalizeTag('enhancement')).toBe('enhancement');
  });
});

describe('extractHashtags', () => {
  it('extracts all hashtags from markdown', () => {
    const md = 'This is a #feature request for the #bug-fix branch';
    expect(extractHashtags(md)).toEqual(['feature', 'bug-fix']);
  });

  it('deduplicates repeated hashtags', () => {
    expect(extractHashtags('#todo and #todo again')).toEqual(['todo']);
  });

  it('returns empty array when no hashtags present', () => {
    expect(extractHashtags('No tags here')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isColorDark
// ---------------------------------------------------------------------------

describe('isColorDark', () => {
  it('identifies black as dark', () => {
    expect(isColorDark('#000000')).toBe(true);
  });

  it('identifies white as light', () => {
    expect(isColorDark('#FFFFFF')).toBe(false);
  });

  it('identifies a mid-blue as dark', () => {
    // #3B82F6 — standard blue
    expect(isColorDark('#3B82F6')).toBe(true);
  });

  it('identifies a light yellow as light', () => {
    expect(isColorDark('#FEF08A')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isOverdue
// ---------------------------------------------------------------------------

describe('isOverdue', () => {
  it('returns true for a date in the past', () => {
    expect(isOverdue('2020-01-01T00:00:00.000Z')).toBe(true);
  });

  it('returns false for a date in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isOverdue(future)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// chunk
// ---------------------------------------------------------------------------

describe('chunk', () => {
  it('splits array into equal chunks', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it('handles remainder in last chunk', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('handles empty array', () => {
    expect(chunk([], 3)).toEqual([]);
  });
});
