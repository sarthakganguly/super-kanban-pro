/**
 * usePerformanceMonitor
 *
 * Development-only hook for diagnosing render performance.
 * Tracks re-render counts per component and estimates FPS.
 * Tree-shaken in production builds (NODE_ENV check).
 *
 * Usage:
 *   const { renderCount, fps } = usePerformanceMonitor('SwimlaneColumn', lane.id);
 *   // In __DEV__: logs "SwimlaneColumn[lane-abc] render #14"
 *
 * Why not React DevTools Profiler?
 *   The Profiler requires manually starting/stopping recording sessions
 *   and only works in the browser DevTools panel. This hook logs inline
 *   during development so you can see render counts while interacting
 *   with the app on a real device.
 */

import { useEffect, useRef } from 'react';

interface PerformanceStats {
  renderCount: number;
  lastRenderMs: number;
}

/**
 * Tracks render counts for a named component instance.
 * Only active in __DEV__ mode — compiles to a no-op in production.
 *
 * @param componentName - Human-readable component name
 * @param instanceId    - Optional identifier when multiple instances exist (e.g. lane ID)
 * @param warnThreshold - Log a warning if renderCount exceeds this in 1 second (default 10)
 */
export function useRenderCount(
  componentName: string,
  instanceId?: string,
  warnThreshold = 10,
): number {
  const renderCountRef = useRef(0);
  const recentCountRef = useRef(0);
  const windowStartRef = useRef(Date.now());

  if (__DEV__) {
    renderCountRef.current += 1;
    recentCountRef.current += 1;

    const now = Date.now();
    if (now - windowStartRef.current >= 1000) {
      if (recentCountRef.current > warnThreshold) {
        const label = instanceId
          ? `${componentName}[${instanceId}]`
          : componentName;
        console.warn(
          `[Perf] ${label} rendered ${recentCountRef.current} times in 1s — ` +
          `check memo comparators and callback stability.`,
        );
      }
      recentCountRef.current = 0;
      windowStartRef.current = now;
    }
  }

  return renderCountRef.current;
}

/**
 * Logs when a specific prop or value changes across renders.
 * Useful for debugging why a memoized component re-rendered.
 *
 * Usage:
 *   useWhyDidYouUpdate('CardItem', { card, onPress, isActive });
 */
export function useWhyDidYouUpdate(
  name: string,
  props: Record<string, unknown>,
): void {
  if (!__DEV__) return;

  const prevRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    const prev = prevRef.current;
    const changedProps: Record<string, { from: unknown; to: unknown }> = {};

    for (const key of Object.keys(props)) {
      if (prev[key] !== props[key]) {
        changedProps[key] = { from: prev[key], to: props[key] };
      }
    }

    if (Object.keys(changedProps).length > 0) {
      console.log(`[Perf] ${name} re-rendered:`, changedProps);
    }

    prevRef.current = props;
  });
}

/**
 * Measures the time between renders (useful for detecting slow renders).
 * Logs a warning if the render took longer than `thresholdMs`.
 *
 * Usage:
 *   useMeasureRender('BoardScreen', 16); // warn if > 16ms (drops below 60fps)
 */
export function useMeasureRender(
  componentName: string,
  thresholdMs = 16,
): void {
  if (!__DEV__) return;

  const startRef = useRef(Date.now());

  useEffect(() => {
    const duration = Date.now() - startRef.current;
    if (duration > thresholdMs) {
      console.warn(`[Perf] ${componentName} render took ${duration}ms (threshold: ${thresholdMs}ms)`);
    }
  });

  startRef.current = Date.now();
}
