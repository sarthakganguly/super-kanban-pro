/**
 * ProjectRepository
 *
 * Database operations for `projects`.
 * All queries exclude soft-deleted records by default.
 */

import { Database, Q } from '@nozbe/watermelondb';
import { ProjectModel } from '../models/ProjectModel';

export class ProjectRepository {
  constructor(private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /** All active (non-deleted) projects for a user, newest first */
  async findAllByUserId(userId: string): Promise<ProjectModel[]> {
    return this.db
      .get<ProjectModel>('projects')
      .query(
        Q.and(
          Q.where('user_id', Q.eq(userId)),
          Q.where('deleted_at', Q.eq(null)),
        ),
        Q.sortBy('created_at', Q.desc),
      )
      .fetch();
  }

  async findById(id: string): Promise<ProjectModel | null> {
    try {
      const project = await this.db.get<ProjectModel>('projects').find(id);
      return project.isDeleted ? null : project;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  async create(userId: string, name: string): Promise<ProjectModel> {
    const now = Date.now();

    return this.db.write(async () =>
      this.db.get<ProjectModel>('projects').create((record) => {
        record.userId = userId;
        record.name   = name;
        (record._raw as Record<string, unknown>)['created_at'] = now;
        (record._raw as Record<string, unknown>)['updated_at'] = now;
        (record._raw as Record<string, unknown>)['deleted_at'] = null;
      }),
    );
  }

  async rename(projectId: string, name: string): Promise<void> {
    const project = await this.db.get<ProjectModel>('projects').find(projectId);

    await this.db.write(async () => {
      await project.update((record) => {
        record.name = name;
        (record._raw as Record<string, unknown>)['updated_at'] = Date.now();
      });
    });
  }

  /** Soft delete — sets deleted_at, hides from all normal queries */
  async softDelete(projectId: string): Promise<void> {
    const project = await this.db.get<ProjectModel>('projects').find(projectId);

    await this.db.write(async () => {
      await project.update((record) => {
        (record._raw as Record<string, unknown>)['deleted_at'] = Date.now();
        (record._raw as Record<string, unknown>)['updated_at'] = Date.now();
      });
    });
  }

  /** Permanently removes the record — irreversible */
  async hardDelete(projectId: string): Promise<void> {
    const project = await this.db.get<ProjectModel>('projects').find(projectId);
    await this.db.write(async () => {
      await project.destroyPermanently();
    });
  }
}
