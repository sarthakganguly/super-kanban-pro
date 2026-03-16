/**
 * ThumbnailCache
 *
 * An in-memory LRU (Least Recently Used) cache for decoded thumbnail
 * data: URI strings.
 *
 * Why a cache here?
 *   Every time a thumbnail is displayed, the app must:
 *     1. Look up the storageRef in the AttachmentModel
 *     2. Read the binary data from IndexedDB (web) or the filesystem (native)
 *     3. Base64-encode it into a data: URI
 *     4. Pass the URI to <Image source={{ uri }} />
 *
 *   Steps 2–3 are async and non-trivial for large thumbnails (~5–30KB each).
 *   When the user scrolls a board with 50 cards that each have images,
 *   these async loads cause visible flicker as thumbnails pop in.
 *
 *   The cache stores the final data: URI in memory so steps 2–3 happen
 *   only once per session. Subsequent renders of the same thumbnail are
 *   synchronous — no flicker.
 *
 * LRU eviction:
 *   The cache keeps the N most recently accessed entries. When capacity
 *   is exceeded, the least recently used entry is dropped.
 *   This bounds memory usage even when the user has thousands of attachments.
 *
 * Memory accounting:
 *   A base64 data: URI for a 200×200 JPEG thumbnail at 70% quality is
 *   approximately 8–15 KB. With MAX_ENTRIES=200, peak memory is ~3 MB —
 *   acceptable for a foreground app on any device manufactured after 2016.
 *
 * Cross-platform:
 *   The cache is a plain TypeScript class. It works identically on
 *   React Native (iOS, Android) and React Native Web.
 *
 * Usage:
 *   const cache = ThumbnailCache.getInstance();
 *   const uri = cache.get(storageRef);
 *   if (!uri) {
 *     const loaded = await loadDataURL(storageRef, mimeType);
 *     if (loaded) cache.set(storageRef, loaded);
 *   }
 */

// ---------------------------------------------------------------------------
// LRU Node
// ---------------------------------------------------------------------------

interface LRUNode {
  key:   string;
  value: string;
  prev:  LRUNode | null;
  next:  LRUNode | null;
}

// ---------------------------------------------------------------------------
// ThumbnailCache
// ---------------------------------------------------------------------------

export class ThumbnailCache {
  private readonly capacity: number;
  private readonly map:  Map<string, LRUNode> = new Map();

  // Doubly-linked list — head = most recently used, tail = least recently used
  private head: LRUNode | null = null;
  private tail: LRUNode | null = null;

  // Singleton instance
  private static _instance: ThumbnailCache | null = null;

  /**
   * Returns the shared singleton instance.
   * Creates it on first call with the default capacity.
   *
   * @param capacity - Maximum number of entries (default 200, ~3 MB at 15KB/thumb)
   */
  static getInstance(capacity = 200): ThumbnailCache {
    if (!ThumbnailCache._instance) {
      ThumbnailCache._instance = new ThumbnailCache(capacity);
    }
    return ThumbnailCache._instance;
  }

  /**
   * Resets the singleton (useful for testing and for clearing on logout).
   */
  static reset(): void {
    ThumbnailCache._instance = null;
  }

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Returns the cached data: URI for the given storage reference, or null
   * if not present. Moves the entry to the head (most recently used).
   */
  get(key: string): string | null {
    const node = this.map.get(key);
    if (!node) return null;

    // Move to head (mark as most recently used)
    this.moveToHead(node);
    return node.value;
  }

  /**
   * Stores a data: URI in the cache.
   * If the cache is at capacity, the least recently used entry is evicted.
   */
  set(key: string, value: string): void {
    const existing = this.map.get(key);

    if (existing) {
      existing.value = value;
      this.moveToHead(existing);
      return;
    }

    const node: LRUNode = { key, value, prev: null, next: null };
    this.map.set(key, node);
    this.addToHead(node);

    if (this.map.size > this.capacity) {
      this.evictTail();
    }
  }

  /**
   * Removes a specific entry from the cache.
   * Call this when an attachment is deleted.
   */
  delete(key: string): void {
    const node = this.map.get(key);
    if (!node) return;
    this.removeNode(node);
    this.map.delete(key);
  }

  /**
   * Removes all entries. Call on user logout to release memory.
   */
  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  /** Returns the number of cached entries */
  get size(): number {
    return this.map.size;
  }

  /** Returns the current cache capacity */
  get maxCapacity(): number {
    return this.capacity;
  }

  /**
   * Returns cache statistics for diagnostics.
   */
  getStats(): { size: number; capacity: number; hitRatio: number } {
    return {
      size:     this.size,
      capacity: this.capacity,
      hitRatio: this._hits / Math.max(1, this._hits + this._misses),
    };
  }

  // Hit/miss tracking for diagnostics
  private _hits   = 0;
  private _misses = 0;

  /**
   * Same as get(), but also tracks hit/miss ratio for diagnostics.
   */
  getTracked(key: string): string | null {
    const result = this.get(key);
    if (result) this._hits++;
    else        this._misses++;
    return result;
  }

  // ---------------------------------------------------------------------------
  // Private LRU helpers
  // ---------------------------------------------------------------------------

  private addToHead(node: LRUNode): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) this.head.prev = node;
    this.head = node;

    if (!this.tail) this.tail = node;
  }

  private removeNode(node: LRUNode): void {
    if (node.prev) node.prev.next = node.next;
    else           this.head      = node.next;

    if (node.next) node.next.prev = node.prev;
    else           this.tail      = node.prev;

    node.prev = null;
    node.next = null;
  }

  private moveToHead(node: LRUNode): void {
    if (node === this.head) return;
    this.removeNode(node);
    this.addToHead(node);
  }

  private evictTail(): void {
    if (!this.tail) return;
    this.map.delete(this.tail.key);
    this.removeNode(this.tail);
  }
}
