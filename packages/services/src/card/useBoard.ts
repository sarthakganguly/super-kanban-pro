/**
 * useBoard hook
 *
 * The central hook for the Kanban board screen.
 * Loads swimlanes + all cards for the active project, then exposes
 * actions for creating/moving/updating/deleting cards and lanes.
 *
 * State shape:
 *   lanes  — ordered array of Swimlane objects
 *   cards  — Map<laneId, Card[]> sorted by positionIndex
 *
 * The hook performs a single initial load then manages local state
 * optimistically — writes go to the DB in the background, UI updates
 * immediately. If a write fails, local state is rolled back and an
 * error is set.
 *
 * Usage:
 *   const { lanes, cards, createCard, moveCard } = useBoard(projectId);
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDatabase } from '@kanban/database';
import type { Card, Swimlane } from '@kanban/types';
import { CardError, CardService, type CreateCardInput, type MoveCardInput, type UpdateCardInput } from '../card/CardService';
import { SwimlaneService } from '../swimlane/SwimlaneService';

export interface UseBoardReturn {
  lanes:   Swimlane[];
  cards:   Map<string, Card[]>;
  isLoading: boolean;
  error:   string | null;
  clearError: () => void;

  // Card actions
  createCard:  (input: CreateCardInput) => Promise<Card | null>;
  updateCard:  (cardId: string, input: UpdateCardInput) => Promise<Card | null>;
  moveCard:    (input: MoveCardInput) => Promise<void>;
  deleteCard:  (cardId: string) => Promise<void>;

  // Lane actions
  createLane:  (name: string, color: string) => Promise<void>;
  renameLane:  (laneId: string, name: string) => Promise<void>;
  recolorLane: (laneId: string, color: string) => Promise<void>;
  deleteLane:  (laneId: string) => Promise<void>;

  // Reload from DB (after an error rollback or external change)
  reload: () => Promise<void>;
}

export function useBoard(projectId: string): UseBoardReturn {
  const db = useDatabase();

  const [lanes,     setLanes]     = useState<Swimlane[]>([]);
  const [cards,     setCards]     = useState<Map<string, Card[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Stable service refs — recreated only if db changes (never in practice)
  const cardSvc  = useRef(new CardService(db));
  const laneSvc  = useRef(new SwimlaneService(db));
  useEffect(() => {
    cardSvc.current = new CardService(db);
    laneSvc.current = new SwimlaneService(db);
  }, [db]);

  const clearError = useCallback(() => setError(null), []);

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedLanes = await laneSvc.current.getLanesForProject(projectId);
      const laneIds     = loadedLanes.map((l) => l.id);
      const loadedCards = await cardSvc.current.getCardsForProject(laneIds);

      setLanes(loadedLanes);
      setCards(loadedCards);
    } catch (err) {
      setError('Failed to load board. Please try again.');
      console.error('[useBoard] load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // ---------------------------------------------------------------------------
  // Card: create
  // ---------------------------------------------------------------------------

  const createCard = useCallback(
    async (input: CreateCardInput): Promise<Card | null> => {
      try {
        const card = await cardSvc.current.createCard(input);

        // Optimistic append to the correct lane
        setCards((prev) => {
          const next = new Map(prev);
          const lane = next.get(input.laneId) ?? [];
          next.set(input.laneId, [...lane, card]);
          return next;
        });

        return card;
      } catch (err) {
        setError(err instanceof CardError ? err.message : 'Failed to create card.');
        return null;
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Card: update
  // ---------------------------------------------------------------------------

  const updateCard = useCallback(
    async (cardId: string, input: UpdateCardInput): Promise<Card | null> => {
      // Snapshot for rollback
      const snapshot = new Map(cards);

      try {
        const updated = await cardSvc.current.updateCard(cardId, input);

        setCards((prev) => {
          const next = new Map(prev);
          for (const [laneId, laneCards] of next) {
            const idx = laneCards.findIndex((c) => c.id === cardId);
            if (idx !== -1) {
              const newCards = [...laneCards];
              newCards[idx] = updated;
              next.set(laneId, newCards);
              break;
            }
          }
          return next;
        });

        return updated;
      } catch (err) {
        setCards(snapshot);
        setError(err instanceof CardError ? err.message : 'Failed to update card.');
        return null;
      }
    },
    [cards],
  );

  // ---------------------------------------------------------------------------
  // Card: move
  // ---------------------------------------------------------------------------

  const moveCard = useCallback(
    async (input: MoveCardInput): Promise<void> => {
      // Optimistic move — find the card, remove from source, splice into target
      const snapshot = new Map(cards);

      setCards((prev) => {
        const next = new Map(prev);
        let movingCard: Card | undefined;

        // Remove from current lane
        for (const [laneId, laneCards] of next) {
          const idx = laneCards.findIndex((c) => c.id === input.cardId);
          if (idx !== -1) {
            movingCard = laneCards[idx];
            next.set(laneId, laneCards.filter((_, i) => i !== idx));
            break;
          }
        }

        if (!movingCard) return prev;

        // Compute insertion index in target lane
        const targetCards = [...(next.get(input.targetLaneId) ?? [])];
        let insertAt = targetCards.length; // default: append

        if (input.nextCardId) {
          const nextIdx = targetCards.findIndex((c) => c.id === input.nextCardId);
          if (nextIdx !== -1) insertAt = nextIdx;
        } else if (input.prevCardId) {
          const prevIdx = targetCards.findIndex((c) => c.id === input.prevCardId);
          if (prevIdx !== -1) insertAt = prevIdx + 1;
        }

        targetCards.splice(insertAt, 0, { ...movingCard, laneId: input.targetLaneId });
        next.set(input.targetLaneId, targetCards);
        return next;
      });

      try {
        await cardSvc.current.moveCard(input);
      } catch {
        // Roll back optimistic update
        setCards(snapshot);
        setError('Failed to move card. Please try again.');
      }
    },
    [cards],
  );

  // ---------------------------------------------------------------------------
  // Card: delete
  // ---------------------------------------------------------------------------

  const deleteCard = useCallback(
    async (cardId: string): Promise<void> => {
      const snapshot = new Map(cards);

      // Optimistic remove
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

      try {
        await cardSvc.current.deleteCard(cardId);
      } catch {
        setCards(snapshot);
        setError('Failed to delete card.');
      }
    },
    [cards],
  );

  // ---------------------------------------------------------------------------
  // Lane actions
  // ---------------------------------------------------------------------------

  const createLane = useCallback(async (name: string, color: string) => {
    try {
      const lane = await laneSvc.current.createLane(projectId, name, color);
      setLanes((prev) => [...prev, lane]);
      setCards((prev) => new Map(prev).set(lane.id, []));
    } catch (err) {
      setError('Failed to create lane.');
    }
  }, [projectId]);

  const renameLane = useCallback(async (laneId: string, name: string) => {
    try {
      await laneSvc.current.renameLane(laneId, name);
      setLanes((prev) =>
        prev.map((l) => (l.id === laneId ? { ...l, name } : l)),
      );
    } catch {
      setError('Failed to rename lane.');
    }
  }, []);

  const recolorLane = useCallback(async (laneId: string, color: string) => {
    try {
      await laneSvc.current.recolorLane(laneId, color);
      setLanes((prev) =>
        prev.map((l) => (l.id === laneId ? { ...l, color } : l)),
      );
    } catch {
      setError('Failed to update lane color.');
    }
  }, []);

  const deleteLane = useCallback(
    async (laneId: string) => {
      const snapshotLanes = [...lanes];
      const snapshotCards = new Map(cards);

      setLanes((prev) => prev.filter((l) => l.id !== laneId));
      setCards((prev) => {
        const next = new Map(prev);
        next.delete(laneId);
        return next;
      });

      try {
        await laneSvc.current.deleteLane(laneId);
      } catch {
        setLanes(snapshotLanes);
        setCards(snapshotCards);
        setError('Failed to delete lane.');
      }
    },
    [lanes, cards],
  );

  return {
    lanes,
    cards,
    isLoading,
    error,
    clearError,
    createCard,
    updateCard,
    moveCard,
    deleteCard,
    createLane,
    renameLane,
    recolorLane,
    deleteLane,
    reload,
  };
}
