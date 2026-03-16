/**
 * DragContext — stale closure fix
 *
 * Problem: endDrag() was created via useCallback with `state` in its dep array.
 * The mousedown handler in DraggableCardItem captures endDrag at call time.
 * By mouseup, state has changed (setHoverLane / setDropIndex were called) but
 * the captured endDrag still sees the original state — so targetLaneId is always
 * the source lane and dropIndex is always null.
 *
 * Fix: maintain a stateRef that is always in sync with React state.
 * endDrag reads from stateRef.current (always fresh) instead of the closure.
 * Similarly, onDrop is stored in a ref so changes to it between mousedown and
 * mouseup don't cause another stale-closure issue.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated } from 'react-native';
import type { Card } from '@kanban/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LaneBound {
  laneId: string;
  left:   number;
  right:  number;
  top:    number;
}

export interface DragState {
  isDragging:    boolean;
  dragCard:      Card | null;
  sourceLaneId:  string | null;
  targetLaneId:  string | null;
  dropIndex:     number | null;
}

export interface DragContextValue extends DragState {
  dragPosition: Animated.ValueXY;

  startDrag:    (card: Card, sourceLaneId: string) => void;
  setHoverLane: (laneId: string | null) => void;
  setDropIndex: (index: number | null) => void;
  endDrag:      () => Promise<void>;
  cancelDrag:   () => void;

  registerLaneBounds: (laneId: string, left: number, right: number, top: number) => void;
  getLaneAtX:         (pageX: number) => string | null;
  getLaneBound:       (laneId: string) => LaneBound | null;
}

const IDLE_STATE: DragState = {
  isDragging:   false,
  dragCard:     null,
  sourceLaneId: null,
  targetLaneId: null,
  dropIndex:    null,
};

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const DragContext = createContext<DragContextValue>(null!);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface DragProviderProps {
  children: ReactNode;
  onDrop: (
    card:         Card,
    sourceLaneId: string,
    targetLaneId: string,
    dropIndex:    number,
  ) => Promise<void>;
}

export function DragProvider({ children, onDrop }: DragProviderProps) {
  const [state, _setState] = useState<DragState>(IDLE_STATE);

  // Always-current ref — endDrag reads this instead of the closure value
  const stateRef = useRef<DragState>(IDLE_STATE);

  // Always-current ref for onDrop — avoids a second stale-closure vector
  const onDropRef = useRef(onDrop);
  useEffect(() => { onDropRef.current = onDrop; }, [onDrop]);

  /** Set both the React state (for re-renders) and the ref (for endDrag). */
  const setState = useCallback((next: DragState) => {
    stateRef.current = next;
    _setState(next);
  }, []);

  const dragPosition  = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const laneBoundsRef = useRef<LaneBound[]>([]);

  // ---------------------------------------------------------------------------
  // Lane bounds
  // ---------------------------------------------------------------------------

  const registerLaneBounds = useCallback(
    (laneId: string, left: number, right: number, top: number) => {
      const idx   = laneBoundsRef.current.findIndex((b) => b.laneId === laneId);
      const bound = { laneId, left, right, top };
      if (idx >= 0) laneBoundsRef.current[idx] = bound;
      else          laneBoundsRef.current.push(bound);
    },
    [],
  );

  const getLaneAtX = useCallback((pageX: number): string | null => {
    for (const b of laneBoundsRef.current) {
      if (pageX >= b.left && pageX <= b.right) return b.laneId;
    }
    return null;
  }, []);

  const getLaneBound = useCallback(
    (laneId: string): LaneBound | null =>
      laneBoundsRef.current.find((b) => b.laneId === laneId) ?? null,
    [],
  );

  // ---------------------------------------------------------------------------
  // Drag lifecycle
  // ---------------------------------------------------------------------------

  const startDrag = useCallback((card: Card, sourceLaneId: string) => {
    setState({
      isDragging:   true,
      dragCard:     card,
      sourceLaneId,
      targetLaneId: sourceLaneId,
      dropIndex:    null,
    });
  }, [setState]);

  const setHoverLane = useCallback((laneId: string | null) => {
    setState({ ...stateRef.current, targetLaneId: laneId });
  }, [setState]);

  const setDropIndex = useCallback((index: number | null) => {
    setState({ ...stateRef.current, dropIndex: index });
  }, [setState]);

  const endDrag = useCallback(async () => {
    // Read from the ref — ALWAYS has the latest targetLaneId and dropIndex
    const { dragCard, sourceLaneId, targetLaneId, dropIndex } = stateRef.current;

    // Reset immediately so the UI snaps back
    setState(IDLE_STATE);
    dragPosition.setValue({ x: 0, y: 0 });

    if (dragCard && sourceLaneId && targetLaneId && dropIndex !== null) {
      await onDropRef.current(dragCard, sourceLaneId, targetLaneId, dropIndex);
    }
  // No deps on state or onDrop — we deliberately read refs instead
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragPosition, setState]);

  const cancelDrag = useCallback(() => {
    setState(IDLE_STATE);
    dragPosition.setValue({ x: 0, y: 0 });
  }, [dragPosition, setState]);

  return (
    <DragContext.Provider
      value={{
        ...state,
        dragPosition,
        startDrag,
        setHoverLane,
        setDropIndex,
        endDrag,
        cancelDrag,
        registerLaneBounds,
        getLaneAtX,
        getLaneBound,
      }}
    >
      {children}
    </DragContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDragContext(): DragContextValue {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error('useDragContext must be used inside <DragProvider>');
  return ctx;
}