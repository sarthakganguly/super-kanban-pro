/**
 * DatabaseContext
 *
 * React context that makes the DatabaseProvider available throughout
 * the entire component tree without prop drilling.
 *
 * Usage:
 *   // In App.tsx (wrap once at the root):
 *   <DatabaseContextProvider provider={dbProvider}>
 *     <App />
 *   </DatabaseContextProvider>
 *
 *   // In any component or service hook:
 *   const { cards, projects } = useDatabase();
 *   const cardModels = await cards.findByLaneId(laneId);
 *
 * Why a context instead of a module-level singleton?
 *   - Testability: tests can inject a mock provider without monkeypatching modules
 *   - React lifecycle: the provider is guaranteed to be ready before any
 *     component attempts a query (context throws if used outside the provider)
 *   - Future: hot-swapping adapters (e.g. switching from local to sync mode)
 *     becomes a simple context value update
 */

import React, {
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import type { DatabaseProvider } from '../DatabaseProvider';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const DatabaseContext = createContext<DatabaseProvider>(null!);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface DatabaseContextProviderProps {
  provider: DatabaseProvider;
  children: ReactNode;
}

/**
 * Wraps the app (or a subtree) with a ready DatabaseProvider.
 * The provider must be created before render — do not create it inside render.
 */
export function DatabaseContextProvider({
  provider,
  children,
}: DatabaseContextProviderProps) {
  return (
    <DatabaseContext.Provider value={provider}>
      {children}
    </DatabaseContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the DatabaseProvider from context.
 * Throws with a helpful message if called outside DatabaseContextProvider.
 */
export function useDatabase(): DatabaseProvider {
  const ctx = useContext(DatabaseContext);

  if (!ctx) {
    throw new Error(
      'useDatabase() must be called inside <DatabaseContextProvider>. ' +
      'Wrap your app root with <DatabaseContextProvider provider={dbProvider}>.',
    );
  }

  return ctx;
}
