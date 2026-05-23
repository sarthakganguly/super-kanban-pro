/**
 * GarbageCollector integration tests
 */

import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { createDatabaseProvider, type DatabaseProvider } from '@kanban/database';
import { schema } from '@kanban/database/src/schema';
import { migrations } from '@kanban/database/src/schema/migrations';
import { SettingsService } from '../settings/SettingsService';
import type { ProjectModel, SwimlaneModel, CardModel, AttachmentModel } from '@kanban/database';

// ---------------------------------------------------------------------------
// Mock Storage
// ---------------------------------------------------------------------------

const mockRemove = jest.fn().mockResolvedValue(undefined);
const mockStorage = {
  remove: mockRemove,
  save: jest.fn().mockResolvedValue({ key: 'test-file', sizeBytes: 1234 }),
  load: jest.fn(),
  loadAsDataURL: jest.fn(),
  exists: jest.fn(),
};

jest.mock('../attachment/BlobStorageService', () => ({
  getBlobStorage: () => mockStorage,
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function createTestDatabase(): DatabaseProvider {
  const adapter = new LokiJSAdapter({
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });

  return createDatabaseProvider(adapter);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SettingsService.emptyTrash integration tests', () => {
  let db: DatabaseProvider;
  let svc: SettingsService;
  let userId: string;

  beforeEach(async () => {
    db = createTestDatabase();
    svc = new SettingsService(db);
    mockRemove.mockClear();

    // Create user
    const user = await db.users.create('gc_tester', 'test-pass-123');
    userId = user.id;
  });

  it('permanently deletes soft-deleted projects/cards and cleans up physical files', async () => {
    // 1. Create Projects
    const activeProject = await db.projects.create(userId, 'Active Project');
    const deletedProject = await db.projects.create(userId, 'Deleted Project');
    await db.projects.softDelete(deletedProject.id);

    // 2. Create Swimlanes
    const activeLanes = await db.swimlanes.createDefaults(activeProject.id);
    const activeLane = activeLanes[0]!;

    const deletedLanes = await db.swimlanes.createDefaults(deletedProject.id);
    const deletedLane = deletedLanes[0]!;

    // 3. Create Cards in Active Project
    const keepCard = await db.cards.create({
      laneId: activeLane.id,
      title: 'Active card to keep',
    });

    const softDeletedCard = await db.cards.create({
      laneId: activeLane.id,
      title: 'Soft-deleted card to prune',
    });
    await db.cards.softDelete(softDeletedCard.id);

    // 4. Create Cards in Soft-Deleted Project
    const cardInDeletedProject = await db.cards.create({
      laneId: deletedLane.id,
      title: 'Card inside deleted project',
    });

    // 5. Create Attachments
    const keepAttachment = await db.attachments.create({
      cardId: keepCard.id,
      type: 'image',
      filename: 'keep.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      storageRef: 'keep-ref',
      thumbnailRef: 'keep-thumb',
    });

    const softDeletedCardAttachment = await db.attachments.create({
      cardId: softDeletedCard.id,
      type: 'image',
      filename: 'card-prune.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 200,
      storageRef: 'prune-ref',
      thumbnailRef: 'prune-thumb',
    });

    const deletedProjectCardAttachment = await db.attachments.create({
      cardId: cardInDeletedProject.id,
      type: 'txt',
      filename: 'proj-prune.txt',
      mimeType: 'text/plain',
      sizeBytes: 300,
      storageRef: 'proj-ref',
      thumbnailRef: null,
    });

    // 6. Run Empty Trash
    await svc.emptyTrash(userId);

    // 7. Verify Database state
    // Verify projects
    const pActive = await db.db.get<ProjectModel>('projects').find(activeProject.id);
    expect(pActive).toBeTruthy();
    await expect(db.db.get<ProjectModel>('projects').find(deletedProject.id)).rejects.toThrow();

    // Verify swimlanes
    const activeSwimlanes = await db.swimlanes.findByProjectId(activeProject.id);
    expect(activeSwimlanes.length).toBeGreaterThan(0);
    const deletedSwimlanesList = await db.db.get<SwimlaneModel>('swimlanes')
      .query()
      .fetch();
    const deletedSwimlanesForProj = deletedSwimlanesList.filter(l => l.projectId === deletedProject.id);
    expect(deletedSwimlanesForProj.length).toBe(0);

    // Verify cards
    const activeCards = await db.cards.findByLaneId(activeLane.id);
    expect(activeCards.length).toBe(1);
    expect(activeCards[0]!.id).toBe(keepCard.id);

    // Verify all remaining cards in DB
    const allCards = await db.db.get<CardModel>('cards').query().fetch();
    expect(allCards.some(c => c.id === softDeletedCard.id)).toBe(false);
    expect(allCards.some(c => c.id === cardInDeletedProject.id)).toBe(false);

    // Verify attachments in DB
    const remainingAttachments = await db.db.get<AttachmentModel>('attachments').query().fetch();
    expect(remainingAttachments.some(a => a.id === keepAttachment.id)).toBe(true);
    expect(remainingAttachments.some(a => a.id === softDeletedCardAttachment.id)).toBe(false);
    expect(remainingAttachments.some(a => a.id === deletedProjectCardAttachment.id)).toBe(false);

    // 8. Verify Physical Storage deletion
    // Should remove files for the pruned card and the deleted project card, but NOT the kept card.
    expect(mockRemove).toHaveBeenCalledWith('prune-ref');
    expect(mockRemove).toHaveBeenCalledWith('prune-thumb');
    expect(mockRemove).toHaveBeenCalledWith('proj-ref');
    expect(mockRemove).not.toHaveBeenCalledWith('keep-ref');
    expect(mockRemove).not.toHaveBeenCalledWith('keep-thumb');
  });
});
