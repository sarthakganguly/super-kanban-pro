/**
 * useLiveBoard
 *
 * A performance-optimised, reactive replacement for useBoard.
 * Uses WatermelonDB's observe() API so the board updates automatically
 * when cards are created/moved/deleted without any manual reload calls.
 *
 * Architecture comparison vs useBoard:
 *
 *   useBoard (Phase 5):
 *     - One-shot fetch on mount
 *     - Optimistic local state mutations
 *     - Manual rollback on failure
 *     - ~500 cards: fine. 2000+ cards: initial load visible pause.
 *
 *   useLiveBoard (Phase 10):
 *     - WatermelonDB observable subscription per lane
 *     - No local state for card lists — DB is the single source of truth
 *     - Mutations write to DB; the subscription fires and re-renders
 *     - ~5000 cards: LokiJS in-memory, synchronous, no pause
 *     - Concurrent writes from future sync don't need manual merge
 *
 * Subscription strategy:
 *   One subscription per swimlane, not one for the whole board.
 *   This means adding a card to "In Progress" only re-renders that
 *   one lane's FlatList, not all lanes.
 *
 * InteractionManager:
 *   The initial subscriptions are deferred via InteractionManager.runAfterInteractions
 *   so they don't compete with the board's slide-in navigation animation.
 *
 * Performance budget:
 *   Target: 60fps scroll on a board with 500 cards across 3 lanes
 *   on a mid-tier 2020 Android device (the primary constraint).
 */

/**
 * packages/services/src/card/useLiveBoard.ts
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Q } from '@nozbe/watermelondb';
import type { Subscription } from 'rxjs';
import { useDatabase } from '@kanban/database';
import type { CardModel, SwimlaneModel } from '@kanban/database';
import type { Card, Swimlane } from '@kanban/types';
import { sortByPosition } from '@kanban/utils';
import {
  CardError,
  CardService,
  type CreateCardInput,
  type MoveCardInput,
  type UpdateCardInput,
} from './CardService';
import { SwimlaneService } from '../swimlane/SwimlaneService';

export interface UseLiveBoardReturn {
  lanes:     Swimlane[];
  cards:     Map<string, Card[]>;
  isLoading: boolean;
  error:     string | null;
  clearError: () => void;
  createCard:  (input: CreateCardInput) => Promise<Card | null>;
  updateCard:  (cardId: string, input: UpdateCardInput) => Promise<Card | null>;
  moveCard:    (input: MoveCardInput) => Promise<void>;
  deleteCard:  (cardId: string) => Promise<void>;
  createLane:  (name: string, color: string) => Promise<void>;
  renameLane:  (laneId: string, name: string) => Promise<void>;
  recolorLane: (laneId: string, color: string) => Promise<void>;
  deleteLane:  (laneId: string) => Promise<void>;
  rebalanceIfNeeded: () => Promise<void>;
}

const REBALANCE_PRECISION_THRESHOLD = 1e-10;

function toSwimlane(m: SwimlaneModel): Swimlane {
  return {
    id:        m.id,
    projectId: m.projectId,
    name:      m.name,
    color:     m.color,
    position:  m.position,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

function toCard(m: CardModel): Card {
  return {
    id:                  m.id,
    laneId:              m.laneId,
    title:               m.title,
    descriptionMarkdown: m.descriptionMarkdown,
    color:               m.color,
    statusColor:         m.statusColor,
    dueDate:             m.dueDate ? m.dueDate.toISOString() : null,
    positionIndex:       m.positionIndex,
    createdAt:           m.createdAt.toISOString(),
    updatedAt:           m.updatedAt.toISOString(),
    deletedAt:           m.deletedAt ? m.deletedAt.toISOString() : null,
  };
}

export function useLiveBoard(projectId: string): UseLiveBoardReturn {
  const db = useDatabase();
  const [lanes,     setLanes]     = useState<Swimlane[]>([]);
  const [cards,     setCards]     = useState<Map<string, Card[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const subsRef  = useRef<SubscriptionWithTag[]>([]);
  const cardSvc  = useRef(new CardService(db));
  const laneSvc  = useRef(new SwimlaneService(db));

  const latestLanesRef = useRef<Swimlane[]>([]);
  const latestCardsRef = useRef<Map<string, Card[]>>(new Map());

  useEffect(() => { latestLanesRef.current = lanes; },[lanes]);
  useEffect(() => { latestCardsRef.current = cards; }, [cards]);
  useEffect(() => {
    cardSvc.current = new CardService(db);
    laneSvc.current = new SwimlaneService(db);
  }, [db]);

  const clearError = useCallback(() => setError(null),[]);

  useEffect(() => {
    subsRef.current.forEach((s) => s.unsubscribe());
    subsRef.current =[];
    setIsLoading(true);

    const laneSub = db.db
      .get<SwimlaneModel>('swimlanes')
      .query(Q.where('project_id', Q.eq(projectId)), Q.sortBy('position', Q.asc))
      .observe()
      .subscribe({
        next: (laneModels) => {
          const newLanes = laneModels.map(toSwimlane);
          setLanes(newLanes);

          const oldCardSubs = subsRef.current.filter((s) => s.tag === 'card');
          oldCardSubs.forEach((s) => s.unsubscribe());
          subsRef.current = subsRef.current.filter((s) => s.tag !== 'card');

          newLanes.forEach((lane) => {
            const cardSub = db.db
              .get<CardModel>('cards')
              .query(
                Q.and(
                  Q.where('lane_id', Q.eq(lane.id)),
                  Q.where('deleted_at', Q.eq(null)),
                ),
              )
              .observe()
              .subscribe({
                next: (cardModels) => {
                  const sorted = sortByPosition(cardModels).map(toCard);
                  setCards((prev) => {
                    const next = new Map(prev);
                    next.set(lane.id, sorted);
                    return next;
                  });
                  setIsLoading(false);
                },
                error: (err) => console.error(`[useLiveBoard] card sub error:`, err),
              }) as SubscriptionWithTag;

            cardSub.tag = 'card';
            subsRef.current.push(cardSub);
          });

          if (newLanes.length === 0) setIsLoading(false);
        },
        error: (err) => {
          console.error('[useLiveBoard] lane sub error:', err);
          setError('Failed to load board.');
          setIsLoading(false);
        },
      }) as SubscriptionWithTag;

    laneSub.tag = 'lane';
    subsRef.current.push(laneSub);

    return () => {
      subsRef.current.forEach((s) => s.unsubscribe());
      subsRef.current =[];
    };
  }, [projectId, db]);

  const patchCard = useCallback((updated: Card) => {
    setCards((prev) => {
      for (const [laneId, laneCards] of prev) {
        const idx = laneCards.findIndex((c) => c.id === updated.id);
        if (idx !== -1) {
          const next = new Map(prev);
          const lane = [...laneCards];
          lane[idx] = updated;
          next.set(laneId, lane);
          return next;
        }
      }
      return prev;
    });
  },[]);

  const createCard = useCallback(async (input: CreateCardInput) => {
    try { return await cardSvc.current.createCard(input); } 
    catch (err) { setError(err instanceof CardError ? err.message : 'Failed to create card.'); return null; }
  },[]);

  const updateCard = useCallback(async (cardId: string, input: UpdateCardInput) => {
    try {
      const updated = await cardSvc.current.updateCard(cardId, input);
      patchCard(updated);
      return updated;
    } catch (err) {
      setError(err instanceof CardError ? err.message : 'Failed to update card.');
      return null;
    }
  }, [patchCard]);

  const moveCard = useCallback(async (input: MoveCardInput) => {
    try {
      await cardSvc.current.moveCard(input);
      setCards((prev) => {
        let movingCard: Card | undefined;
        const next = new Map(prev);
        for (const [laneId, laneCards] of next) {
          const idx = laneCards.findIndex((c) => c.id === input.cardId);
          if (idx !== -1) {
            movingCard = laneCards[idx];
            next.set(laneId, laneCards.filter((_, i) => i !== idx));
            break;
          }
        }
        if (!movingCard) return prev;
        const targetCards = [...(next.get(input.targetLaneId) ?? [])];
        targetCards.push({ ...movingCard, laneId: input.targetLaneId });
        next.set(input.targetLaneId, targetCards);
        return next;
      });
    } catch { setError('Failed to move card.'); }
  },[]);

  const deleteCard = useCallback(async (cardId: string) => {
    try {
      await cardSvc.current.deleteCard(cardId);
      setCards((prev) => {
        const next = new Map(prev);
        for (const [laneId, laneCards] of next) {
          const filtered = laneCards.filter((c) => c.id !== cardId);
          if (filtered.length !== laneCards.length) {
            next.set(laneId, filtered);
            break;
          }
        }
        return next;
      });
    } catch { setError('Failed to delete card.'); }
  },[]);

  const createLane = useCallback(async (name: string, color: string) => {
    try { await laneSvc.current.createLane(projectId, name, color); }
    catch { setError('Failed to create lane.'); }
  }, [projectId]);

  const renameLane = useCallback(async (laneId: string, name: string) => {
    setLanes((prev) => prev.map((l) => l.id === laneId ? { ...l, name } : l));
    try { await laneSvc.current.renameLane(laneId, name); }
    catch { setError('Failed to rename lane.'); }
  },[]);

  const recolorLane = useCallback(async (laneId: string, color: string) => {
    setLanes((prev) => prev.map((l) => l.id === laneId ? { ...l, color } : l));
    try { await laneSvc.current.recolorLane(laneId, color); }
    catch { setError('Failed to update lane color.'); }
  },[]);

  const deleteLane = useCallback(async (laneId: string) => {
    console.log('[DEBUG] useLiveBoard: deleteLane called for ID:', laneId);
    const originalLanes =[...latestLanesRef.current];
    const originalCards = new Map(latestCardsRef.current);

    // Optimistic UI hide
    setLanes((prev) => prev.filter((l) => l.id !== laneId));
    setCards((prev) => {
      const next = new Map(prev);
      next.delete(laneId);
      return next;
    });

    try { 
      await laneSvc.current.deleteLane(laneId); 
      console.log('[DEBUG] useLiveBoard: deleteLane database promise resolved successfully.');
    } catch (e) { 
      // Revert if db fails
      setLanes(originalLanes);
      setCards(originalCards);
      console.error('[DEBUG] useLiveBoard: Delete lane failed at DB level:', e);
      setError('Failed to delete lane. Database transaction rejected.'); 
    }
  },[]);

  const rebalanceIfNeeded = useCallback(async () => {
    for (const [laneId, laneCards] of cards) {
      if (laneCards.length < 2) continue;
      let minGap = Infinity;
      for (let i = 1; i < laneCards.length; i++) {
        const gap =
          parseFloat(laneCards[i]!.positionIndex) -
          parseFloat(laneCards[i - 1]!.positionIndex);
        minGap = Math.min(minGap, gap);
      }
      if (minGap < REBALANCE_PRECISION_THRESHOLD) {
        await db.cards.rebalanceLane(laneId);
      }
    }
  },[cards, db.cards]);

  return {
    lanes, cards, isLoading, error, clearError,
    createCard, updateCard, moveCard, deleteCard,
    createLane, renameLane, recolorLane, deleteLane,
    rebalanceIfNeeded,
  };
}

interface SubscriptionWithTag extends Subscription {
  tag?: string;
}