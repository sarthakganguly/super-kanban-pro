/**
 * jest.setup.ts
 *
 * Runs once before all test suites.
 * Configures global mocks and resets state between tests.
 */

// Reset AsyncStorage in-memory store and all jest.fn() calls before each test
beforeEach(() => {
  // The AsyncStorage mock exposes _reset() for cleanup
  const asyncStorage = jest.requireMock(
    '@react-native-async-storage/async-storage',
  ) as { _reset: () => void };

  if (typeof asyncStorage._reset === 'function') {
    asyncStorage._reset();
  }
});

// Silence React Native warnings in test output that aren't relevant to unit tests
global.console.warn = jest.fn();

// Suppress "act()" warnings from React when testing async state updates
// These appear when testing hooks outside of a full React render tree
jest.setTimeout(15_000); // Allow time for real bcrypt hashing in auth tests
