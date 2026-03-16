/**
 * useObservableQuery
 *
 * Subscribes to a WatermelonDB observable query and keeps a React state
 * value in sync with the live database result.
 *
 * This replaces the one-shot `await query.fetch()` pattern with a
 * reactive subscription that automatically pushes updates to components
 * when the underlying data changes — no manual reload required.
 *
 * WatermelonDB's Observable emits:
 *   1. Immediately on subscribe with the current value
 *   2. Whenever a record in the query's result set is created, updated, or deleted
 *
 * Important: WatermelonDB observables are synchronous on the first emit
 * (backed by LokiJS in-memory store on web, or JSI on native) so the
 * initial render receives data without an async round-trip.
 *
 * Usage:
 *   const cards = useObservableQuery(
 *     db.get<CardModel>('cards')
 *       .query(Q.where('lane_id', laneId), Q.where('deleted_at', null))
 *       .observe()
 *   );
 *
 * @template T - The WatermelonDB Model type
 * @param observable$ - A WatermelonDB Observable<T[]> from query.observe()
 * @returns The current query result, or null while loading
 */

import { useEffect, useState } from 'react';
import type { Observable } from 'rxjs';

export function useObservableQuery<T>(observable$: Observable<T[]>): T[] | null {
  const [result, setResult] = useState<T[] | null>(null);

  useEffect(() => {
    // subscribe() returns a Subscription — we call unsubscribe on cleanup
    const subscription = observable$.subscribe({
      next:  (value) => setResult(value),
      error: (err)   => console.error('[useObservableQuery]', err),
    });

    return () => subscription.unsubscribe();
  }, [observable$]); // Re-subscribe if the query changes

  return result;
}

/**
 * useObservableRecord
 *
 * Subscribes to a single WatermelonDB record's observe() stream.
 * Automatically re-renders when any field on the record changes.
 *
 * Usage:
 *   const card = useObservableRecord(cardModel.observe());
 */
export function useObservableRecord<T>(observable$: Observable<T>): T | null {
  const [record, setRecord] = useState<T | null>(null);

  useEffect(() => {
    const subscription = observable$.subscribe({
      next:  (value) => setRecord(value),
      error: (err)   => console.error('[useObservableRecord]', err),
    });
    return () => subscription.unsubscribe();
  }, [observable$]);

  return record;
}
