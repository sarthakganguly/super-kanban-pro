/**
 * ThumbnailCache tests
 *
 * Tests the LRU eviction logic, capacity limits, cache hits/misses,
 * and the singleton pattern.
 */

import { ThumbnailCache } from '../thumbnail/ThumbnailCache';

// Reset singleton between tests
beforeEach(() => {
  ThumbnailCache.reset();
});

// ---------------------------------------------------------------------------
// Basic operations
// ---------------------------------------------------------------------------

describe('ThumbnailCache — basic operations', () => {
  it('stores and retrieves a value', () => {
    const cache = ThumbnailCache.getInstance(10);
    cache.set('key1', 'data:image/jpeg;base64,abc');
    expect(cache.get('key1')).toBe('data:image/jpeg;base64,abc');
  });

  it('returns null for a missing key', () => {
    const cache = ThumbnailCache.getInstance(10);
    expect(cache.get('missing')).toBeNull();
  });

  it('updates an existing entry', () => {
    const cache = ThumbnailCache.getInstance(10);
    cache.set('key1', 'original');
    cache.set('key1', 'updated');
    expect(cache.get('key1')).toBe('updated');
    expect(cache.size).toBe(1);
  });

  it('reports correct size', () => {
    const cache = ThumbnailCache.getInstance(10);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    expect(cache.size).toBe(3);
  });

  it('deletes a specific entry', () => {
    const cache = ThumbnailCache.getInstance(10);
    cache.set('key1', 'value');
    cache.delete('key1');
    expect(cache.get('key1')).toBeNull();
    expect(cache.size).toBe(0);
  });

  it('clear removes all entries', () => {
    const cache = ThumbnailCache.getInstance(10);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// LRU eviction
// ---------------------------------------------------------------------------

describe('ThumbnailCache — LRU eviction', () => {
  it('evicts the least recently used entry when capacity is exceeded', () => {
    const cache = new ThumbnailCache(3);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    // a is LRU at this point
    cache.set('d', '4'); // Should evict 'a'
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
    expect(cache.get('d')).toBe('4');
    expect(cache.size).toBe(3);
  });

  it('updates recency when an entry is accessed (get promotes to head)', () => {
    const cache = new ThumbnailCache(3);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');

    // Access 'a' to promote it — now 'b' is LRU
    cache.get('a');

    cache.set('d', '4'); // Should evict 'b'
    expect(cache.get('b')).toBeNull();
    expect(cache.get('a')).toBe('1');
    expect(cache.get('c')).toBe('3');
    expect(cache.get('d')).toBe('4');
  });

  it('updating an entry promotes it to head', () => {
    const cache = new ThumbnailCache(3);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');

    // Update 'a' — promotes it, making 'b' LRU
    cache.set('a', 'updated');

    cache.set('d', '4'); // Should evict 'b'
    expect(cache.get('b')).toBeNull();
    expect(cache.get('a')).toBe('updated');
  });

  it('evicts correctly with a capacity of 1', () => {
    const cache = new ThumbnailCache(1);
    cache.set('first', 'data1');
    expect(cache.size).toBe(1);

    cache.set('second', 'data2');
    expect(cache.size).toBe(1);
    expect(cache.get('first')).toBeNull();
    expect(cache.get('second')).toBe('data2');
  });

  it('handles filling to capacity exactly without eviction', () => {
    const cache = new ThumbnailCache(5);
    for (let i = 0; i < 5; i++) {
      cache.set(`key${i}`, `val${i}`);
    }
    expect(cache.size).toBe(5);
    // No eviction yet
    for (let i = 0; i < 5; i++) {
      expect(cache.get(`key${i}`)).toBe(`val${i}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('ThumbnailCache — singleton', () => {
  it('getInstance returns the same instance', () => {
    const a = ThumbnailCache.getInstance();
    const b = ThumbnailCache.getInstance();
    expect(a).toBe(b);
  });

  it('reset creates a new instance', () => {
    const a = ThumbnailCache.getInstance();
    a.set('key', 'value');
    ThumbnailCache.reset();
    const b = ThumbnailCache.getInstance();
    expect(b).not.toBe(a);
    expect(b.get('key')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Hit ratio tracking
// ---------------------------------------------------------------------------

describe('ThumbnailCache — diagnostics', () => {
  it('tracks hit ratio correctly', () => {
    const cache = new ThumbnailCache(10);
    cache.set('a', '1');
    cache.set('b', '2');

    cache.getTracked('a');   // hit
    cache.getTracked('a');   // hit
    cache.getTracked('c');   // miss
    cache.getTracked('d');   // miss

    const { hitRatio } = cache.getStats();
    expect(hitRatio).toBeCloseTo(0.5, 2); // 2 hits out of 4 attempts
  });

  it('getStats reports correct size and capacity', () => {
    const cache = new ThumbnailCache(100);
    cache.set('a', '1');
    cache.set('b', '2');

    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.capacity).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('ThumbnailCache — edge cases', () => {
  it('delete on a non-existent key is a no-op', () => {
    const cache = new ThumbnailCache(10);
    expect(() => cache.delete('nonexistent')).not.toThrow();
    expect(cache.size).toBe(0);
  });

  it('clear on an empty cache is a no-op', () => {
    const cache = new ThumbnailCache(10);
    expect(() => cache.clear()).not.toThrow();
    expect(cache.size).toBe(0);
  });

  it('handles many sequential sets without error', () => {
    const cache = new ThumbnailCache(50);
    for (let i = 0; i < 200; i++) {
      cache.set(`key${i}`, `data${i}`);
    }
    expect(cache.size).toBe(50);
    // The last 50 entries should be present
    for (let i = 150; i < 200; i++) {
      expect(cache.get(`key${i}`)).toBe(`data${i}`);
    }
    // The first 150 should have been evicted
    expect(cache.get('key0')).toBeNull();
    expect(cache.get('key149')).toBeNull();
  });
});
