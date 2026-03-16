/**
 * useDragDrop
 *
 * Bridges DragContext (UI drag state) with useBoard (DB mutations).
 *
 * Responsibilities:
 *   1. Creates the onDrop handler that DragProvider calls when a drag ends
 *   2. Resolves (sourceLaneId, targetLaneId, dropIndex) →
 *      (prevCardId, nextCardId) for fractional index calculation
 *   3. Calls useBoard.moveCard() with the computed neighbors
 *
 * The conversion from dropIndex → prevCardId/nextCardId:
 *   dropIndex = 0 → insert before all cards → prevCardId = null, nextCardId = cards[0]
 *   dropIndex = n → insert after cards[n-1] and before cards[n]
 *   dropIndex >= length → append → prevCardId = last card, nextCardId = null
 *
 * Returns the onDrop callback and the lane-layout registration function
 * that columns call to register their x-bounds for hover detection.
 */

import { useCallback, useRef } from 'react';
import type { MoveCardInput } from '@kanban/services';
import type { Card, Swimlane } from '@kanban/types';

interface UseDragDropProps {
  lanes:    Swimlane[];
  cards:    Map<string, Card[]>;
  moveCard: (input: MoveCardInput) => Promise<void>;
}

interface LaneBounds {
  laneId: string;
  left:   number;
  right:  number;
}

export interface UseDragDropReturn {
  onDrop: (
    card:         Card,
    sourceLaneId: string,
    targetLaneId: string,
    dropIndex:    number,
  ) => Promise<void>;
  /** Called by each column on layout to register its x-bounds */
  registerLaneBounds: (laneId: string, left: number, right: number) => void;
  /** Given a page-x coordinate, returns the laneId the point falls in */
  getLaneAtX: (pageX: number) => string | null;
}

export function useDragDrop({
  lanes,
  cards,
  moveCard,
}: UseDragDropProps): UseDragDropReturn {
  // Each column registers its screen bounds so we can resolve laneId from pageX
  const laneBoundsRef = useRef<LaneBounds[]>([]);

  const registerLaneBounds = useCallback(
    (laneId: string, left: number, right: number) => {
      const existing = laneBoundsRef.current.findIndex((b) => b.laneId === laneId);
      if (existing >= 0) {
        laneBoundsRef.current[existing] = { laneId, left, right };
      } else {
        laneBoundsRef.current.push({ laneId, left, right });
      }
    },
    [],
  );

  const getLaneAtX = useCallback((pageX: number): string | null => {
    for (const bounds of laneBoundsRef.current) {
      if (pageX >= bounds.left && pageX <= bounds.right) {
        return bounds.laneId;
      }
    }
    return null;
  }, []);

  /**
   * Converts (targetLaneId, dropIndex) → (prevCardId, nextCardId)
   *
   * dropIndex is the position IN the target lane where the card lands.
   * cards.get(targetLaneId) gives the current ordered list for that lane.
   *
   * Example with ["A","B","C"] and dropIndex=1:
   *   → prevCardId="A", nextCardId="B"
   *   → fractional index will be computed as (A.index + B.index) / 2
   */
  const resolveNeighbors = useCallback(
    (
      cardId:       string,
      targetLaneId: string,
      dropIndex:    number,
    ): { prevCardId: string | null; nextCardId: string | null } => {
      const targetCards = (cards.get(targetLaneId) ?? []).filter(
        (c) => c.id !== cardId, // exclude the card being moved from neighbor resolution
      );

      const clampedIndex = Math.max(0, Math.min(dropIndex, targetCards.length));

      const prevCardId = clampedIndex > 0
        ? (targetCards[clampedIndex - 1]?.id ?? null)
        : null;

      const nextCardId = clampedIndex < targetCards.length
        ? (targetCards[clampedIndex]?.id ?? null)
        : null;

      return { prevCardId, nextCardId };
    },
    [cards],
  );

  const onDrop = useCallback(
    async (
      card:         Card,
      sourceLaneId: string,
      targetLaneId: string,
      dropIndex:    number,
    ) => {
      // No-op if dropped in the same position in the same lane
      const sourceLaneCards  = cards.get(sourceLaneId) ?? [];
      const currentIndex     = sourceLaneCards.findIndex((c) => c.id === card.id);
      const isSameLane       = sourceLaneId === targetLaneId;
      const isUnchanged      = isSameLane && currentIndex === dropIndex;

      if (isUnchanged) return;

      const { prevCardId, nextCardId } = resolveNeighbors(
        card.id,
        targetLaneId,
        dropIndex,
      );

      await moveCard({
        cardId:       card.id,
        targetLaneId,
        prevCardId,
        nextCardId,
      });
    },
    [cards, resolveNeighbors, moveCard],
  );

  return { onDrop, registerLaneBounds, getLaneAtX };
}
