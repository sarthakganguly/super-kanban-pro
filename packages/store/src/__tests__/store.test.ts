/**
 * Unit tests for @kanban/store
 *
 * Tests the store slices in isolation using Zustand's built-in testing pattern:
 * create a fresh store instance per test to avoid state leaking between tests.
 */

import { create } from 'zustand';
import { createAuthSlice, type AuthSlice } from '../slices/authSlice';
import { createProjectSlice, type ProjectSlice } from '../slices/projectSlice';
import { createUISlice, type UISlice } from '../slices/uiSlice';
import type { User } from '@kanban/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const mockUser: User = {
  id: 'user-123',
  username: 'testuser',
  passwordHash: '$2b$12$hashedpassword',
  createdAt: '2024-01-01T00:00:00.000Z',
};

// Create isolated stores per test (avoids global state pollution)
const createAuthStore = () => create<AuthSlice>()((...a) => createAuthSlice(...a));
const createProjectStore = () => create<ProjectSlice>()((...a) => createProjectSlice(...a));
const createUIStore = () => create<UISlice>()((...a) => createUISlice(...a));

// ---------------------------------------------------------------------------
// AuthSlice
// ---------------------------------------------------------------------------

describe('AuthSlice', () => {
  it('starts unauthenticated', () => {
    const store = createAuthStore();
    expect(store.getState().currentUser).toBeNull();
    expect(store.getState().isAuthenticated).toBe(false);
  });

  it('setCurrentUser sets user and flips isAuthenticated', () => {
    const store = createAuthStore();
    store.getState().setCurrentUser(mockUser);
    expect(store.getState().currentUser).toEqual(mockUser);
    expect(store.getState().isAuthenticated).toBe(true);
  });

  it('clearCurrentUser resets to unauthenticated state', () => {
    const store = createAuthStore();
    store.getState().setCurrentUser(mockUser);
    store.getState().clearCurrentUser();
    expect(store.getState().currentUser).toBeNull();
    expect(store.getState().isAuthenticated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ProjectSlice
// ---------------------------------------------------------------------------

describe('ProjectSlice', () => {
  it('starts with no active project', () => {
    const store = createProjectStore();
    expect(store.getState().activeProjectId).toBeNull();
  });

  it('setActiveProject stores the project ID', () => {
    const store = createProjectStore();
    store.getState().setActiveProject('project-abc');
    expect(store.getState().activeProjectId).toBe('project-abc');
  });

  it('clearActiveProject resets to null', () => {
    const store = createProjectStore();
    store.getState().setActiveProject('project-abc');
    store.getState().clearActiveProject();
    expect(store.getState().activeProjectId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// UISlice
// ---------------------------------------------------------------------------

describe('UISlice', () => {
  it('defaults to system theme and no loading state', () => {
    const store = createUIStore();
    expect(store.getState().themeMode).toBe('system');
    expect(store.getState().isLoading).toBe(false);
    expect(store.getState().loadingMessage).toBeNull();
  });

  it('setThemeMode updates the theme', () => {
    const store = createUIStore();
    store.getState().setThemeMode('dark');
    expect(store.getState().themeMode).toBe('dark');
  });

  it('setLoading(true) enables loading with message', () => {
    const store = createUIStore();
    store.getState().setLoading(true, 'Saving...');
    expect(store.getState().isLoading).toBe(true);
    expect(store.getState().loadingMessage).toBe('Saving...');
  });

  it('setLoading(false) clears loading and message', () => {
    const store = createUIStore();
    store.getState().setLoading(true, 'Saving...');
    store.getState().setLoading(false);
    expect(store.getState().isLoading).toBe(false);
    expect(store.getState().loadingMessage).toBeNull();
  });
});
