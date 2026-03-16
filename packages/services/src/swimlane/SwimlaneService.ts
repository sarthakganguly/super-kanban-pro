/**
 * SwimlaneService
 *
 * Business logic for swimlane (column) management.
 * Swimlanes use integer positioning — there are typically 3–10 of them,
 * so rewriting all positions on a reorder is cheap and avoids the
 * complexity of fractional indexing for columns.
 */

import type { DatabaseProvider, SwimlaneModel } from '@kanban/database';
import type { Swimlane } from '@kanban/types';

export class SwimlaneError extends Error {
  constructor(
    message: string,
    public readonly code: 'VALIDATION_ERROR' | 'NOT_FOUND',
  ) {
    super(message);
    this.name = 'SwimlaneError';
  }
}

export class SwimlaneService {
  constructor(private readonly db: DatabaseProvider) {}

  async getLanesForProject(projectId: string): Promise<Swimlane[]> {
    const models = await this.db.swimlanes.findByProjectId(projectId);
    return models.map(this.modelToSwimlane);
  }

  async createLane(
    projectId: string,
    name: string,
    color: string,
  ): Promise<Swimlane> {
    if (!name.trim()) {
      throw new SwimlaneError('Lane name cannot be empty.', 'VALIDATION_ERROR');
    }
    // Append at the end — position = current count
    const existing = await this.db.swimlanes.findByProjectId(projectId);
    const position = existing.length;
    const model = await this.db.swimlanes.create(
      projectId,
      name.trim(),
      color,
      position,
    );
    return this.modelToSwimlane(model);
  }

  async renameLane(laneId: string, name: string): Promise<void> {
    if (!name.trim()) {
      throw new SwimlaneError('Lane name cannot be empty.', 'VALIDATION_ERROR');
    }
    const existing = await this.db.swimlanes.findById(laneId);
    if (!existing) throw new SwimlaneError('Lane not found.', 'NOT_FOUND');
    await this.db.swimlanes.update(laneId, { name: name.trim() });
  }

  async recolorLane(laneId: string, color: string): Promise<void> {
    await this.db.swimlanes.update(laneId, { color });
  }

  async deleteLane(laneId: string): Promise<void> {
    const existing = await this.db.swimlanes.findById(laneId);
    if (!existing) throw new SwimlaneError('Lane not found.', 'NOT_FOUND');
    await this.db.swimlanes.delete(laneId);
  }

  private modelToSwimlane(model: SwimlaneModel): Swimlane {
    return {
      id:        model.id,
      projectId: model.projectId,
      name:      model.name,
      color:     model.color,
      position:  model.position,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
    };
  }
}
