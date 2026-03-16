/**
 * AuthService tests
 *
 * Tests validation functions and AuthService operations using a mock
 * DatabaseProvider so no real database or AsyncStorage is needed.
 *
 * AsyncStorage is mocked via the standard jest mock approach.
 * bcryptjs is NOT mocked — we test real hashing so security properties hold.
 * (bcrypt at cost 12 takes ~250ms; Jest timeout is set to 15s for these tests.)
 */

import { AuthError, AuthService, validatePassword, validateUsername } from '../auth/AuthService';
import type { DatabaseProvider } from '@kanban/database';

// ---------------------------------------------------------------------------
// Mock AsyncStorage
// ---------------------------------------------------------------------------

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem:    jest.fn(),
  setItem:    jest.fn(),
  removeItem: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
const mockStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// ---------------------------------------------------------------------------
// Mock DatabaseProvider
// ---------------------------------------------------------------------------

function makeMockDb(overrides: Partial<DatabaseProvider['users']> = {}): DatabaseProvider {
  return {
    db: {} as never,
    users: {
      create:              jest.fn(),
      findByUsername:      jest.fn().mockResolvedValue(null),
      findById:            jest.fn().mockResolvedValue(null),
      findAll:             jest.fn().mockResolvedValue([]),
      findConfigByUserId:  jest.fn().mockResolvedValue(null),
      updateConfig:        jest.fn().mockResolvedValue(undefined),
      delete:              jest.fn().mockResolvedValue(undefined),
      ...overrides,
    },
    projects:  {} as never,
    swimlanes: {} as never,
    cards:     {} as never,
  };
}

// ---------------------------------------------------------------------------
// validateUsername
// ---------------------------------------------------------------------------

describe('validateUsername', () => {
  it('accepts valid usernames', () => {
    expect(validateUsername('alice').valid).toBe(true);
    expect(validateUsername('bob_99').valid).toBe(true);
    expect(validateUsername('user-name').valid).toBe(true);
    expect(validateUsername('ABC').valid).toBe(true);
  });

  it('rejects usernames shorter than 3 chars', () => {
    const result = validateUsername('ab');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/at least 3/);
  });

  it('rejects usernames longer than 30 chars', () => {
    const result = validateUsername('a'.repeat(31));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/30 characters/);
  });

  it('rejects usernames with special characters', () => {
    expect(validateUsername('user@name').valid).toBe(false);
    expect(validateUsername('user name').valid).toBe(false);
    expect(validateUsername('user!').valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePassword
// ---------------------------------------------------------------------------

describe('validatePassword', () => {
  it('accepts passwords of 8+ chars', () => {
    expect(validatePassword('password').valid).toBe(true);
    expect(validatePassword('a'.repeat(128)).valid).toBe(true);
  });

  it('rejects passwords shorter than 8 chars', () => {
    const result = validatePassword('short');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/8 characters/);
  });

  it('rejects passwords longer than 128 chars', () => {
    expect(validatePassword('a'.repeat(129)).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AuthService.register
// ---------------------------------------------------------------------------

describe('AuthService.register', () => {
  // Increase timeout for real bcrypt hashing
  jest.setTimeout(15_000);

  it('hashes the password and creates a user', async () => {
    const mockUserModel = {
      id:        'user-1',
      username:  'alice',
      passwordHash: 'hashed',
      createdAt: new Date(),
    };

    const db = makeMockDb({
      create: jest.fn().mockResolvedValue(mockUserModel),
    });

    mockStorage.setItem.mockResolvedValue(undefined);

    const service = new AuthService(db);
    const user    = await service.register('Alice', 'password123');

    expect(user.id).toBe('user-1');
    expect(user.username).toBe('alice');
    // passwordHash must be empty — never returned to callers
    expect(user.passwordHash).toBe('');

    // Verify create was called with a bcrypt hash, not plain text
    const createCall = (db.users.create as jest.Mock).mock.calls[0];
    expect(createCall[0]).toBe('alice'); // lowercased
    expect(createCall[1]).toMatch(/^\$2[ab]\$/); // bcrypt hash prefix

    // Verify session was persisted
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      '@kanban/session_user_id',
      'user-1',
    );
  });

  it('throws VALIDATION_ERROR for short username', async () => {
    const db      = makeMockDb();
    const service = new AuthService(db);

    await expect(service.register('ab', 'password123')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('throws VALIDATION_ERROR for short password', async () => {
    const db      = makeMockDb();
    const service = new AuthService(db);

    await expect(service.register('alice', 'short')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('throws USERNAME_TAKEN when username already exists', async () => {
    const db = makeMockDb({
      findByUsername: jest.fn().mockResolvedValue({ id: 'existing' }),
    });

    const service = new AuthService(db);

    await expect(service.register('alice', 'password123')).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
    });
  });
});

// ---------------------------------------------------------------------------
// AuthService.login
// ---------------------------------------------------------------------------

describe('AuthService.login', () => {
  jest.setTimeout(15_000);

  it('returns a user on correct credentials', async () => {
    // Create a real bcrypt hash for the test password
    const bcrypt = await import('bcryptjs');
    const hash   = await bcrypt.hash('correctpass', 10); // lower rounds for speed

    const mockUserModel = {
      id:           'user-1',
      username:     'alice',
      passwordHash: hash,
      createdAt:    new Date(),
    };

    const db = makeMockDb({
      findByUsername: jest.fn().mockResolvedValue(mockUserModel),
    });

    mockStorage.setItem.mockResolvedValue(undefined);

    const service = new AuthService(db);
    const user    = await service.login('alice', 'correctpass');

    expect(user.id).toBe('user-1');
    expect(user.passwordHash).toBe('');
  });

  it('throws USER_NOT_FOUND for unknown username', async () => {
    const db = makeMockDb({
      findByUsername: jest.fn().mockResolvedValue(null),
    });

    const service = new AuthService(db);

    await expect(service.login('nobody', 'password')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });

  it('throws WRONG_PASSWORD for incorrect password', async () => {
    const bcrypt = await import('bcryptjs');
    const hash   = await bcrypt.hash('correctpass', 10);

    const mockUserModel = {
      id:           'user-1',
      username:     'alice',
      passwordHash: hash,
      createdAt:    new Date(),
    };

    const db = makeMockDb({
      findByUsername: jest.fn().mockResolvedValue(mockUserModel),
    });

    const service = new AuthService(db);

    await expect(service.login('alice', 'wrongpass')).rejects.toMatchObject({
      code: 'WRONG_PASSWORD',
    });
  });
});

// ---------------------------------------------------------------------------
// AuthService.restoreSession
// ---------------------------------------------------------------------------

describe('AuthService.restoreSession', () => {
  it('returns the user when a valid session exists', async () => {
    const mockUserModel = {
      id:        'user-1',
      username:  'alice',
      passwordHash: 'hash',
      createdAt: new Date(),
    };

    const db = makeMockDb({
      findById: jest.fn().mockResolvedValue(mockUserModel),
    });

    mockStorage.getItem.mockResolvedValue('user-1');

    const service = new AuthService(db);
    const user    = await service.restoreSession();

    expect(user).not.toBeNull();
    expect(user!.id).toBe('user-1');
  });

  it('returns null when no session key is stored', async () => {
    const db = makeMockDb();
    mockStorage.getItem.mockResolvedValue(null);

    const service = new AuthService(db);
    const user    = await service.restoreSession();

    expect(user).toBeNull();
  });

  it('clears stale session when user no longer exists', async () => {
    const db = makeMockDb({
      findById: jest.fn().mockResolvedValue(null),
    });

    mockStorage.getItem.mockResolvedValue('deleted-user-id');
    mockStorage.removeItem.mockResolvedValue(undefined);

    const service = new AuthService(db);
    const user    = await service.restoreSession();

    expect(user).toBeNull();
    expect(mockStorage.removeItem).toHaveBeenCalledWith('@kanban/session_user_id');
  });
});
