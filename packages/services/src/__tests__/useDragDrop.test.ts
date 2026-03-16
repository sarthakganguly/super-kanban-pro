/**
 * useDragDrop tests
 *
 * Tests the neighbor resolution logic that converts (targetLaneId, dropIndex)
 * → (prevCardId, nextCardId) for fractional index calculation.
 *
 * This is pure logic — no React rendering needed, so we test the
 * resolveNeighbors function by calling useDragDrop with a mock moveCard
 * and invoking onDrop directly.
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useDragDrop } from '../../../packages/ui/src/screens/board/drag/useDragDrop';
import type { Card, Swimlane } from '@kanban/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(id: string, laneId: string, position: string): Card {
  return {
    id,
    laneId,
    title:               `Card ${id}`,
    descriptionMarkdown: '',
    color:               null,
    statusColor:         null,
    dueDate:             null,
    positionIndex:       position,
    createdAt:           '2024-01-01T00:00:00.000Z',
    updatedAt:           '2024-01-01T00:00:00.000Z',
    deletedAt:           null,
  };
}

function makeLane(id: string): Swimlane {
  return {
    id,
    projectId: 'proj-1',
    name:      `Lane ${id}`,
    color:     '#3B82F6',
    position:  0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDragDrop', () => {
  const mockMoveCard = jest.fn().mockResolvedValue(undefined);

  const laneA = makeLane('lane-a');
  const laneB = makeLane('lane-b');

  const cardA1 = makeCard('a1', 'lane-a', '1');
  const cardA2 = makeCard('a2', 'lane-a', '2');
  const cardA3 = makeCard('a3', 'lane-a', '3');

  const lanes = [laneA, laneB];
  const cards = new Map([
    ['lane-a', [cardA1, cardA2, cardA3]],
    ['lane-b', []],
  ]);

  beforeEach(() => {
    mockMoveCard.mockClear();
  });

  it('inserts at top of lane (dropIndex=0): prevCardId=null, nextCardId=first', async () => {
    const { result } = renderHook(() =>
      useDragDrop({ lanes, cards, moveCard: mockMoveCard }),
    );

    await act(async () => {
      await result.current.onDrop(cardA3, 'lane-a', 'lane-a', 0);
    });

    expect(mockMoveCard).toHaveBeenCalledWith({
      cardId:       'a3',
      targetLaneId: 'lane-a',
      prevCardId:   null,
      nextCardId:   'a1',  // a3 is excluded from neighbors, so first remaining = a1
    });
  });

  it('inserts between two cards: dropIndex=1 with [a1,a2,a3] → prev=a1, next=a2', async () => {
    const { result } = renderHook(() =>
      useDragDrop({ lanes, cards, moveCard: mockMoveCard }),
    );

    // Moving a NEW card (not in the list) to index 1
    const newCard = makeCard('new', 'lane-b', '1');
    await act(async () => {
      await result.current.onDrop(newCard, 'lane-b', 'lane-a', 1);
    });

    expect(mockMoveCard).toHaveBeenCalledWith({
      cardId:       'new',
      targetLaneId: 'lane-a',
      prevCardId:   'a1',
      nextCardId:   'a2',
    });
  });

  it('appends at end (dropIndex >= length): prevCardId=last, nextCardId=null', async () => {
    const { result } = renderHook(() =>
      useDragDrop({ lanes, cards, moveCard: mockMoveCard }),
    );

    const newCard = makeCard('new', 'lane-b', '1');
    await act(async () => {
      await result.current.onDrop(newCard, 'lane-b', 'lane-a', 99);
    });

    expect(mockMoveCard).toHaveBeenCalledWith({
      cardId:       'new',
      targetLaneId: 'lane-a',
      prevCardId:   'a3',
      nextCardId:   null,
    });
  });

  it('drops into an empty lane: prevCardId=null, nextCardId=null', async () => {
    const { result } = renderHook(() =>
      useDragDrop({ lanes, cards, moveCard: mockMoveCard }),
    );

    await act(async () => {
      await result.current.onDrop(cardA1, 'lane-a', 'lane-b', 0);
    });

    expect(mockMoveCard).toHaveBeenCalledWith({
      cardId:       'a1',
      targetLaneId: 'lane-b',
      prevCardId:   null,
      nextCardId:   null,
    });
  });

  it('does NOT call moveCard when card is dropped in the same position', async () => {
    const { result } = renderHook(() =>
      useDragDrop({ lanes, cards, moveCard: mockMoveCard }),
    );

    // cardA1 is at index 0 in lane-a — dropping at index 0 is a no-op
    await act(async () => {
      await result.current.onDrop(cardA1, 'lane-a', 'lane-a', 0);
    });

    expect(mockMoveCard).not.toHaveBeenCalled();
  });

  it('cross-lane drop: excludes dragged card from neighbor list', async () => {
    // lane-b has [cardB1, cardB2]; moving cardA1 to index 1 in lane-b
    const cardB1 = makeCard('b1', 'lane-b', '1');
    const cardB2 = makeCard('b2', 'lane-b', '2');
    const cardsWithB = new Map([
      ['lane-a', [cardA1, cardA2, cardA3]],
      ['lane-b', [cardB1, cardB2]],
    ]);

    const { result } = renderHook(() =>
      useDragDrop({ lanes, cards: cardsWithB, moveCard: mockMoveCard }),
    );

    await act(async () => {
      await result.current.onDrop(cardA1, 'lane-a', 'lane-b', 1);
    });

    expect(mockMoveCard).toHaveBeenCalledWith({
      cardId:       'a1',
      targetLaneId: 'lane-b',
      prevCardId:   'b1',
      nextCardId:   'b2',
    });
  });

  it('registerLaneBounds and getLaneAtX resolve correct lane', () => {
    const { result } = renderHook(() =>
      useDragDrop({ lanes, cards, moveCard: mockMoveCard }),
    );

    act(() => {
      result.current.registerLaneBounds('lane-a', 0, 292);
      result.current.registerLaneBounds('lane-b', 304, 596);
    });

    expect(result.current.getLaneAtX(100)).toBe('lane-a');
    expect(result.current.getLaneAtX(400)).toBe('lane-b');
    expect(result.current.getLaneAtX(700)).toBeNull();
  });
});
