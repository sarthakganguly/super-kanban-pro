/**
 * AuthService
 *
 * Handles all authentication operations:
 *   - Registration: validate input → hash password → create user record
 *   - Login: find user → verify hash → return user
 *   - Session: persist/restore current user ID to AsyncStorage
 *   - Logout: clear session
 *
 * Security design:
 *   - Passwords are hashed with bcrypt, cost factor 12.
 *     At cost 12, a single hash takes ~250ms on a modern device — fast enough
 *     for UX, slow enough to resist brute-force attacks on a stolen database.
 *   - The raw password never leaves this service. Only the hash is stored.
 *   - Session persistence stores only the user ID (not the hash) in AsyncStorage.
 *     On app restart, we re-fetch the full UserModel from the database.
 *   - Username validation enforces: 3–30 chars, alphanumeric + underscore/hyphen.
 *
 * Platform note:
 *   bcrypt is implemented in pure JS (no native modules) via the 'bcryptjs' package,
 *   which works identically on React Native and web.
 */

import bcrypt from 'bcryptjs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DatabaseProvider } from '@kanban/database';
import type { User } from '@kanban/types';
import type { UserModel } from '@kanban/database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** bcrypt work factor — higher = slower hash = harder to brute-force */
const BCRYPT_ROUNDS = 12;

/** AsyncStorage key for persisting the logged-in user ID across app restarts */
const SESSION_KEY = '@kanban/session_user_id';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

/**
 * Validates a username string.
 * Rules: 3–30 chars, alphanumeric, underscore, and hyphen only.
 */
export function validateUsername(username: string): ValidationResult {
  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters.' };
  }
  if (trimmed.length > 30) {
    return { valid: false, error: 'Username must be 30 characters or fewer.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Username may only contain letters, numbers, underscores, and hyphens.',
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates a password string.
 * Rules: 8+ chars. No complexity requirements — length is sufficient entropy.
 */
export function validatePassword(password: string): ValidationResult {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password must be 128 characters or fewer.' };
  }

  return { valid: true, error: null };
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'USERNAME_TAKEN'
      | 'USER_NOT_FOUND'
      | 'WRONG_PASSWORD'
      | 'VALIDATION_ERROR'
      | 'UNKNOWN',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------

export class AuthService {
  constructor(private readonly db: DatabaseProvider) {}

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Registers a new user.
   *
   * Steps:
   *   1. Validate username and password format
   *   2. Check username is not already taken
   *   3. Hash password with bcrypt (cost 12)
   *   4. Create user + default config in DB (atomic transaction)
   *   5. Persist session
   *
   * @returns The created User domain object
   * @throws AuthError on validation failure or duplicate username
   */
  async register(username: string, password: string): Promise<User> {
    // Step 1: Validate inputs
    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) {
      throw new AuthError(usernameCheck.error!, 'VALIDATION_ERROR');
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      throw new AuthError(passwordCheck.error!, 'VALIDATION_ERROR');
    }

    // Step 2: Ensure username is unique (case-insensitive)
    const existing = await this.db.users.findByUsername(username.toLowerCase());
    if (existing) {
      throw new AuthError(
        `Username "${username}" is already taken.`,
        'USERNAME_TAKEN',
      );
    }

    // Step 3: Hash password
    // genSalt + hash is split so we can add a loading indicator in Phase 9
    const salt         = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const passwordHash = await bcrypt.hash(password, salt);

    // Step 4: Create user record (repository handles default config atomically)
    const userModel = await this.db.users.create(
      username.toLowerCase(),
      passwordHash,
    );

    // Step 5: Persist session
    await this.persistSession(userModel.id);

    return this.modelToUser(userModel);
  }

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  /**
   * Logs in an existing user.
   *
   * Steps:
   *   1. Find user by username
   *   2. Compare provided password against stored hash
   *   3. Persist session on success
   *
   * Security note:
   *   We return the same generic error for both "user not found" and "wrong password"
   *   to prevent username enumeration attacks, even in local mode.
   *
   * @returns The authenticated User domain object
   * @throws AuthError if credentials are invalid
   */
  async login(username: string, password: string): Promise<User> {
    const userModel = await this.db.users.findByUsername(username.toLowerCase());

    if (!userModel) {
      // Intentional timing delay to match bcrypt time — prevents timing attacks
      await bcrypt.hash(password, BCRYPT_ROUNDS);
      throw new AuthError('Invalid username or password.', 'USER_NOT_FOUND');
    }

    const passwordMatches = await bcrypt.compare(password, userModel.passwordHash);

    if (!passwordMatches) {
      throw new AuthError('Invalid username or password.', 'WRONG_PASSWORD');
    }

    await this.persistSession(userModel.id);

    return this.modelToUser(userModel);
  }

  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------

  /**
   * Restores the session from AsyncStorage.
   * Called on app startup — returns the User if still valid, null otherwise.
   */
  async restoreSession(): Promise<User | null> {
    try {
      const userId = await AsyncStorage.getItem(SESSION_KEY);
      if (!userId) return null;

      const userModel = await this.db.users.findById(userId);
      if (!userModel) {
        // User was deleted — clear stale session
        await this.clearSession();
        return null;
      }

      return this.modelToUser(userModel);
    } catch {
      // AsyncStorage failure is non-fatal — treat as logged out
      return null;
    }
  }

  /**
   * Logs out the current user.
   * Clears the persisted session from AsyncStorage.
   */
  async logout(): Promise<void> {
    await this.clearSession();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async persistSession(userId: string): Promise<void> {
    await AsyncStorage.setItem(SESSION_KEY, userId);
  }

  private async clearSession(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_KEY);
  }

  /**
   * Maps a UserModel (WatermelonDB) to a User (domain type).
   * NEVER includes passwordHash in the returned object.
   */
  private modelToUser(model: UserModel): User {
    return {
      id:           model.id,
      username:     model.username,
      // Explicitly omit passwordHash — callers must not receive it
      passwordHash: '', // Empty string signals "do not use this field"
      createdAt:    model.createdAt.toISOString(),
    };
  }
}
