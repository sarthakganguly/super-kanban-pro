/**
 * Jest manual mock for @react-native-async-storage/async-storage
 *
 * WatermelonDB and AuthService both use AsyncStorage.
 * The real implementation requires native modules that don't exist in Node.
 * This mock provides the same interface backed by an in-memory Map.
 *
 * Jest auto-discovers this file because it's in __mocks__/ adjacent to
 * node_modules. Any test that imports AsyncStorage gets this mock automatically
 * when jest.mock() is called, or when automock is enabled.
 */

const store = new Map<string, string>();

const AsyncStorageMock = {
  getItem: jest.fn(async (key: string): Promise<string | null> => {
    return store.get(key) ?? null;
  }),

  setItem: jest.fn(async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  }),

  removeItem: jest.fn(async (key: string): Promise<void> => {
    store.delete(key);
  }),

  clear: jest.fn(async (): Promise<void> => {
    store.clear();
  }),

  getAllKeys: jest.fn(async (): Promise<string[]> => {
    return Array.from(store.keys());
  }),

  multiGet: jest.fn(async (keys: string[]): Promise<[string, string | null][]> => {
    return keys.map((key) => [key, store.get(key) ?? null]);
  }),

  multiSet: jest.fn(async (keyValuePairs: [string, string][]): Promise<void> => {
    keyValuePairs.forEach(([key, value]) => store.set(key, value));
  }),

  multiRemove: jest.fn(async (keys: string[]): Promise<void> => {
    keys.forEach((key) => store.delete(key));
  }),

  // Helper for tests to reset between test cases
  _reset: () => {
    store.clear();
    jest.clearAllMocks();
  },
};

export default AsyncStorageMock;
