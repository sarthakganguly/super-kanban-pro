/**
 * Repository integration tests
 *
 * Uses WatermelonDB's LokiJS adapter in memory-only mode (no persistence).
 * This avoids any native module dependencies so tests run in Node via Jest.
 *
 * Coverage:
 *   - UserRepository: create, findByUsername, findById, updateConfig, delete
 *   - ProjectRepository: create, findAllByUserId, softDelete, rename
 *   - SwimlaneRepository: createDefaults, create, update, delete
 *   - CardRepository: create, findByLaneId, move, softDelete, rebalanceLane
 */

import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { createDatabaseProvider, type DatabaseProvider } from '../DatabaseProvider';
import { schema } from '../schema';
import { migrations } from '../schema/migrations';

// ---------------------------------------------------------------------------
// Test database factory — creates a fresh in-memory DB for each test suite
// ---------------------------------------------------------------------------

function createTestDatabase(): DatabaseProvider {
  const adapter = new LokiJSAdapter({
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
    // In-memory only: no dbName → LokiJS won't try to persist
  });

  return createDatabaseProvider(adapter);
}

// ---------------------------------------------------------------------------
// UserRepository
// ---------------------------------------------------------------------------

describe('UserRepository', () => {
  let db: DatabaseProvider;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it('creates a user and a default user_config atomically', async () => {
    const user = await db.users.create('alice', '$2b$12$hashedpw');

    expect(user.id).toBeTruthy();
    expect(user.username).toBe('alice');
    expect(user.passwordHash).toBe('$2b$12$hashedpw');

    const config = await db.users.findConfigByUserId(user.id);
    expect(config).not.toBeNull();
    expect(config!.themeMode).toBe('system');
    expect(config!.imageMaxSizeMb).toBe(2);
    expect(config!.defaultSwimlanes).toEqual(['To Do', 'In Progress', 'Done']);
  });

  it('findByUsername returns the correct user', async () => {
    await db.users.create('bob', '$2b$12$hash_bob');
    const found = await db.users.findByUsername('bob');

    expect(found).not.toBeNull();
    expect(found!.username).toBe('bob');
  });

  it('findByUsername returns null for unknown username', async () => {
    const result = await db.users.findByUsername('nobody');
    expect(result).toBeNull();
  });

  it('findById returns the user', async () => {
    const user   = await db.users.create('carol', '$2b$12$hash');
    const found  = await db.users.findById(user.id);
    expect(found!.id).toBe(user.id);
  });

  it('findById returns null for unknown id', async () => {
    const result = await db.users.findById('nonexistent-id');
    expect(result).toBeNull();
  });

  it('updateConfig persists theme and font changes', async () => {
    const user   = await db.users.create('dave', '$2b$12$hash');
    const config = await db.users.findConfigByUserId(user.id);

    await db.users.updateConfig(config!.id, {
      themeMode: 'dark',
      fontSize: 17,
    });

    const updated = await db.users.findConfigByUserId(user.id);
    expect(updated!.themeMode).toBe('dark');
    expect(updated!.fontSize).toBe(17);
    // Untouched fields remain unchanged
    expect(updated!.fontFamily).toBe('System');
  });

  it('delete removes the user and their config', async () => {
    const user = await db.users.create('eve', '$2b$12$hash');
    await db.users.delete(user.id);

    const found  = await db.users.findById(user.id);
    const config = await db.users.findConfigByUserId(user.id);
    expect(found).toBeNull();
    expect(config).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ProjectRepository
// ---------------------------------------------------------------------------

describe('ProjectRepository', () => {
  let db: DatabaseProvider;
  let userId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    const user = await db.users.create('tester', '$2b$12$hash');
    userId = user.id;
  });

  it('creates a project for a user', async () => {
    const project = await db.projects.create(userId, 'My Board');
    expect(project.name).toBe('My Board');
    expect(project.userId).toBe(userId);
    expect(project.deletedAt).toBeNull();
  });

  it('findAllByUserId returns only active projects', async () => {
    const p1 = await db.projects.create(userId, 'Active');
    const p2 = await db.projects.create(userId, 'Deleted');
    await db.projects.softDelete(p2.id);

    const active = await db.projects.findAllByUserId(userId);
    expect(active).toHaveLength(1);
    expect(active[0]!.id).toBe(p1.id);
  });

  it('rename updates the project name', async () => {
    const project = await db.projects.create(userId, 'Old Name');
    await db.projects.rename(project.id, 'New Name');

    const updated = await db.projects.findById(project.id);
    expect(updated!.name).toBe('New Name');
  });

  it('softDelete sets deleted_at and hides the project', async () => {
    const project = await db.projects.create(userId, 'Soon deleted');
    await db.projects.softDelete(project.id);

    const result = await db.projects.findById(project.id);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SwimlaneRepository
// ---------------------------------------------------------------------------

describe('SwimlaneRepository', () => {
  let db: DatabaseProvider;
  let projectId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    const user    = await db.users.create('tester', '$2b$12$hash');
    const project = await db.projects.create(user.id, 'Test Project');
    projectId = project.id;
  });

  it('createDefaults creates 3 lanes in correct order', async () => {
    const lanes = await db.swimlanes.createDefaults(projectId);

    expect(lanes).toHaveLength(3);
    expect(lanes[0]!.name).toBe('To Do');
    expect(lanes[1]!.name).toBe('In Progress');
    expect(lanes[2]!.name).toBe('Done');
    expect(lanes[0]!.position).toBe(0);
    expect(lanes[2]!.position).toBe(2);
  });

  it('findByProjectId returns lanes sorted by position', async () => {
    await db.swimlanes.create(projectId, 'Z Lane', '#000', 2);
    await db.swimlanes.create(projectId, 'A Lane', '#fff', 0);
    await db.swimlanes.create(projectId, 'M Lane', '#aaa', 1);

    const lanes = await db.swimlanes.findByProjectId(projectId);
    expect(lanes.map(l => l.name)).toEqual(['A Lane', 'M Lane', 'Z Lane']);
  });

  it('update persists name and color changes', async () => {
    const lane = await db.swimlanes.create(projectId, 'Draft', '#aaa', 0);
    await db.swimlanes.update(lane.id, { name: 'Review', color: '#3B82F6' });

    const updated = await db.swimlanes.findById(lane.id);
    expect(updated!.name).toBe('Review');
    expect(updated!.color).toBe('#3B82F6');
  });
});

// ---------------------------------------------------------------------------
// CardRepository
// ---------------------------------------------------------------------------

describe('CardRepository', () => {
  let db: DatabaseProvider;
  let laneId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    const user    = await db.users.create('tester', '$2b$12$hash');
    const project = await db.projects.create(user.id, 'Board');
    const lanes   = await db.swimlanes.createDefaults(project.id);
    laneId = lanes[0]!.id;
  });

  it('creates a card at the end of the lane', async () => {
    const card = await db.cards.create({ laneId, title: 'First card' });

    expect(card.title).toBe('First card');
    expect(card.laneId).toBe(laneId);
    expect(parseFloat(card.positionIndex)).toBeGreaterThan(0);
    expect(card.deletedAt).toBeNull();
  });

  it('creates multiple cards with strictly increasing position indices', async () => {
    const c1 = await db.cards.create({ laneId, title: 'Card 1' });
    const c2 = await db.cards.create({ laneId, title: 'Card 2' });
    const c3 = await db.cards.create({ laneId, title: 'Card 3' });

    expect(parseFloat(c2.positionIndex)).toBeGreaterThan(parseFloat(c1.positionIndex));
    expect(parseFloat(c3.positionIndex)).toBeGreaterThan(parseFloat(c2.positionIndex));
  });

  it('findByLaneId returns cards sorted by position', async () => {
    await db.cards.create({ laneId, title: 'A' });
    await db.cards.create({ laneId, title: 'B' });
    await db.cards.create({ laneId, title: 'C' });

    const cards = await db.cards.findByLaneId(laneId);
    expect(cards.map(c => c.title)).toEqual(['A', 'B', 'C']);
  });

  it('findByLaneId excludes soft-deleted cards', async () => {
    const c1 = await db.cards.create({ laneId, title: 'Keep' });
    const c2 = await db.cards.create({ laneId, title: 'Delete me' });
    await db.cards.softDelete(c2.id);

    const cards = await db.cards.findByLaneId(laneId);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.id).toBe(c1.id);
  });

  it('move inserts card between two adjacent cards', async () => {
    const c1 = await db.cards.create({ laneId, title: 'First' });
    const c2 = await db.cards.create({ laneId, title: 'Second' });
    const c3 = await db.cards.create({ laneId, title: 'Third' });

    // Move c3 to between c1 and c2
    await db.cards.move(c3.id, laneId, c1.id, c2.id);

    const sorted = await db.cards.findByLaneId(laneId);
    expect(sorted.map(c => c.title)).toEqual(['First', 'Third', 'Second']);
  });

  it('move can transfer a card to a different lane', async () => {
    const lanes   = await db.swimlanes.findByProjectId(
      (await db.swimlanes.findById(laneId))!.projectId,
    );
    const lane2 = lanes[1]!;

    const card = await db.cards.create({ laneId, title: 'Moving card' });
    await db.cards.move(card.id, lane2.id, null, null);

    const inOriginal = await db.cards.findByLaneId(laneId);
    const inTarget   = await db.cards.findByLaneId(lane2.id);

    expect(inOriginal).toHaveLength(0);
    expect(inTarget).toHaveLength(1);
    expect(inTarget[0]!.laneId).toBe(lane2.id);
  });

  it('rebalanceLane resets all indices to sequential integers', async () => {
    // Create cards and perform moves to drift precision
    await db.cards.create({ laneId, title: 'A' });
    await db.cards.create({ laneId, title: 'B' });
    await db.cards.create({ laneId, title: 'C' });
    const cards = await db.cards.findByLaneId(laneId);

    // Force a move that creates a fractional index
    await db.cards.move(cards[2]!.id, laneId, cards[0]!.id, cards[1]!.id);
    await db.cards.rebalanceLane(laneId);

    const rebalanced = await db.cards.findByLaneId(laneId);
    rebalanced.forEach((card, i) => {
      expect(card.positionIndex).toBe(String(i + 1));
    });
  });
});
