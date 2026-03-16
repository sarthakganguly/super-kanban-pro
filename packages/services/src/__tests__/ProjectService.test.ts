/**
 * ProjectService tests
 *
 * Tests all ProjectService operations using a mock DatabaseProvider.
 * No real database or filesystem required.
 */

import {
  ProjectError,
  ProjectService,
  validateProjectName,
} from '../project/ProjectService';
import type { DatabaseProvider } from '@kanban/database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID    = 'user-abc';
const PROJECT_ID = 'project-xyz';

function makeProjectModel(overrides = {}) {
  return {
    id:        PROJECT_ID,
    userId:    USER_ID,
    name:      'Test Project',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    isDeleted: false,
    ...overrides,
  };
}

function makeSwimlaneModel(overrides = {}) {
  return {
    id:        'lane-1',
    projectId: PROJECT_ID,
    name:      'To Do',
    color:     '#6B7280',
    position:  0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMockDb(
  projectOverrides: Partial<DatabaseProvider['projects']> = {},
  swimlaneOverrides: Partial<DatabaseProvider['swimlanes']> = {},
): DatabaseProvider {
  return {
    db: {} as never,
    users: {} as never,
    cards: {} as never,
    projects: {
      findAllByUserId: jest.fn().mockResolvedValue([]),
      findById:        jest.fn().mockResolvedValue(null),
      create:          jest.fn().mockResolvedValue(makeProjectModel()),
      rename:          jest.fn().mockResolvedValue(undefined),
      softDelete:      jest.fn().mockResolvedValue(undefined),
      hardDelete:      jest.fn().mockResolvedValue(undefined),
      ...projectOverrides,
    },
    swimlanes: {
      findByProjectId: jest.fn().mockResolvedValue([]),
      findById:        jest.fn().mockResolvedValue(null),
      createDefaults:  jest.fn().mockResolvedValue([makeSwimlaneModel()]),
      create:          jest.fn().mockResolvedValue(makeSwimlaneModel()),
      update:          jest.fn().mockResolvedValue(undefined),
      delete:          jest.fn().mockResolvedValue(undefined),
      ...swimlaneOverrides,
    },
  };
}

// ---------------------------------------------------------------------------
// validateProjectName
// ---------------------------------------------------------------------------

describe('validateProjectName', () => {
  it('accepts valid names', () => {
    expect(validateProjectName('My Board').valid).toBe(true);
    expect(validateProjectName('  trimmed  ').valid).toBe(true);
    expect(validateProjectName('a').valid).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateProjectName('').valid).toBe(false);
    expect(validateProjectName('   ').valid).toBe(false);
  });

  it('rejects names over 80 characters', () => {
    expect(validateProjectName('a'.repeat(81)).valid).toBe(false);
  });

  it('accepts exactly 80 characters', () => {
    expect(validateProjectName('a'.repeat(80)).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listProjects
// ---------------------------------------------------------------------------

describe('ProjectService.listProjects', () => {
  it('returns mapped domain objects', async () => {
    const models = [makeProjectModel(), makeProjectModel({ id: 'proj-2', name: 'Second' })];
    const db     = makeMockDb({ findAllByUserId: jest.fn().mockResolvedValue(models) });
    const svc    = new ProjectService(db);

    const result = await svc.listProjects(USER_ID);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe(PROJECT_ID);
    expect(result[0]!.name).toBe('Test Project');
    // passwordHash must not appear on project objects
    expect((result[0] as Record<string, unknown>)['passwordHash']).toBeUndefined();
  });

  it('returns empty array when user has no projects', async () => {
    const db  = makeMockDb({ findAllByUserId: jest.fn().mockResolvedValue([]) });
    const svc = new ProjectService(db);

    const result = await svc.listProjects(USER_ID);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createProject
// ---------------------------------------------------------------------------

describe('ProjectService.createProject', () => {
  it('creates a project and default swimlanes', async () => {
    const db  = makeMockDb();
    const svc = new ProjectService(db);

    const project = await svc.createProject(USER_ID, 'New Board');

    expect(db.projects.create).toHaveBeenCalledWith(USER_ID, 'New Board');
    expect(db.swimlanes.createDefaults).toHaveBeenCalledWith(PROJECT_ID);
    expect(project.name).toBe('Test Project'); // from mock model
  });

  it('trims whitespace from name before creating', async () => {
    const db  = makeMockDb();
    const svc = new ProjectService(db);

    await svc.createProject(USER_ID, '  Padded Name  ');

    expect(db.projects.create).toHaveBeenCalledWith(USER_ID, 'Padded Name');
  });

  it('throws VALIDATION_ERROR for empty name', async () => {
    const db  = makeMockDb();
    const svc = new ProjectService(db);

    await expect(svc.createProject(USER_ID, '')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    expect(db.projects.create).not.toHaveBeenCalled();
  });

  it('throws VALIDATION_ERROR for name over 80 chars', async () => {
    const db  = makeMockDb();
    const svc = new ProjectService(db);

    await expect(
      svc.createProject(USER_ID, 'x'.repeat(81)),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

// ---------------------------------------------------------------------------
// renameProject
// ---------------------------------------------------------------------------

describe('ProjectService.renameProject', () => {
  it('renames a project the user owns', async () => {
    const model = makeProjectModel({ name: 'Old Name' });
    const updated = makeProjectModel({ name: 'New Name' });
    const db = makeMockDb({
      findById: jest.fn()
        .mockResolvedValueOnce(model)    // ownership check
        .mockResolvedValueOnce(updated), // re-fetch after rename
      rename: jest.fn().mockResolvedValue(undefined),
    });
    const svc = new ProjectService(db);

    const result = await svc.renameProject(PROJECT_ID, USER_ID, 'New Name');

    expect(db.projects.rename).toHaveBeenCalledWith(PROJECT_ID, 'New Name');
    expect(result.name).toBe('New Name');
  });

  it('throws NOT_FOUND for unknown project', async () => {
    const db  = makeMockDb({ findById: jest.fn().mockResolvedValue(null) });
    const svc = new ProjectService(db);

    await expect(
      svc.renameProject('ghost-id', USER_ID, 'Name'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws FORBIDDEN when user does not own the project', async () => {
    const model = makeProjectModel({ userId: 'different-user' });
    const db    = makeMockDb({ findById: jest.fn().mockResolvedValue(model) });
    const svc   = new ProjectService(db);

    await expect(
      svc.renameProject(PROJECT_ID, USER_ID, 'Hacked Name'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(db.projects.rename).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteProject
// ---------------------------------------------------------------------------

describe('ProjectService.deleteProject', () => {
  it('soft-deletes a project the user owns', async () => {
    const model = makeProjectModel();
    const db    = makeMockDb({ findById: jest.fn().mockResolvedValue(model) });
    const svc   = new ProjectService(db);

    await svc.deleteProject(PROJECT_ID, USER_ID);

    expect(db.projects.softDelete).toHaveBeenCalledWith(PROJECT_ID);
  });

  it('throws NOT_FOUND for a non-existent project', async () => {
    const db  = makeMockDb({ findById: jest.fn().mockResolvedValue(null) });
    const svc = new ProjectService(db);

    await expect(svc.deleteProject('ghost-id', USER_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws FORBIDDEN when user does not own the project', async () => {
    const model = makeProjectModel({ userId: 'someone-else' });
    const db    = makeMockDb({ findById: jest.fn().mockResolvedValue(model) });
    const svc   = new ProjectService(db);

    await expect(
      svc.deleteProject(PROJECT_ID, USER_ID),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(db.projects.softDelete).not.toHaveBeenCalled();
  });
});
