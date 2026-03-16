/**
 * DatabaseProvider
 *
 * Creates and exposes the WatermelonDB Database instance and all repositories.
 * Apps inject the correct adapter (SQLite or IndexedDB) at startup.
 *
 * Usage:
 *   // In apps/mobile/App.tsx (Phase 2):
 *   const dbProvider = createDatabaseProvider(sqliteAdapter);
 *
 *   // In apps/web/src/App.tsx (Phase 2):
 *   const dbProvider = createDatabaseProvider(indexedDBAdapter);
 *
 * React context for the provider is set up in packages/ui (Phase 5).
 */

import { Database } from '@nozbe/watermelondb';
import type { DatabaseAdapter } from '@nozbe/watermelondb/adapters/type';
import { AttachmentModel } from './models/AttachmentModel';
import { CardModel } from './models/CardModel';
import { CardTagModel } from './models/CardTagModel';
import { ProjectModel } from './models/ProjectModel';
import { SwimlaneModel } from './models/SwimlaneModel';
import { TagModel } from './models/TagModel';
import { UserConfigModel } from './models/UserConfigModel';
import { UserModel } from './models/UserModel';
import { AttachmentRepository } from './repositories/AttachmentRepository';
import { CardRepository } from './repositories/CardRepository';
import { ProjectRepository } from './repositories/ProjectRepository';
import { SwimlaneRepository } from './repositories/SwimlaneRepository';
import { UserRepository } from './repositories/UserRepository';
import { schema } from './schema';
import { migrations } from './schema/migrations';

export interface DatabaseProvider {
  /** The raw WatermelonDB database — use repositories instead when possible */
  db: Database;

  // Repositories — prefer these over direct db.get() calls
  users:       UserRepository;
  projects:    ProjectRepository;
  swimlanes:   SwimlaneRepository;
  cards:       CardRepository;
  attachments: AttachmentRepository;
}

/**
 * Creates a DatabaseProvider with the given adapter.
 * Call once at app startup — the result is a singleton.
 *
 * @param adapter - Platform-specific adapter from @kanban/adapters-sqlite
 *                  or @kanban/adapters-indexeddb
 */
export function createDatabaseProvider(
  adapter: DatabaseAdapter,
): DatabaseProvider {
  const db = new Database({
    adapter,
    modelClasses: [
      UserModel,
      UserConfigModel,
      ProjectModel,
      SwimlaneModel,
      CardModel,
      TagModel,
      CardTagModel,
      AttachmentModel,
    ],
  });

  return {
    db,
    users:       new UserRepository(db),
    projects:    new ProjectRepository(db),
    swimlanes:   new SwimlaneRepository(db),
    cards:       new CardRepository(db),
    attachments: new AttachmentRepository(db),
  };
}
