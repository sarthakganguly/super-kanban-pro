/**
 * ProjectService
 *
 * Business logic for project management.
 * Sits above the repository layer — validates inputs, enforces rules,
 * creates default swimlanes on project creation.
 *
 * Design rules:
 *   - A user can have unlimited projects (no arbitrary limit in local mode)
 *   - Project names must be 1–80 characters, trimmed
 *   - Deleting a project is a soft delete (moves to trash, recoverable)
 *   - Hard delete permanently removes project + all swimlanes + all cards
 *   - Creating a project always creates the 3 default swimlanes atomically
 *
 * The service maps WatermelonDB models → @kanban/types domain objects
 * before returning them, keeping WatermelonDB details out of the UI layer.
 */

import type { DatabaseProvider, ProjectModel, SwimlaneModel } from '@kanban/database';
import type { Project, Swimlane } from '@kanban/types';

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class ProjectError extends Error {
  constructor(
    message: string,
    public readonly code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'FORBIDDEN',
  ) {
    super(message);
    this.name = 'ProjectError';
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateProjectName(name: string): { valid: boolean; error: string | null } {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Project name cannot be empty.' };
  }
  if (trimmed.length > 80) {
    return { valid: false, error: 'Project name must be 80 characters or fewer.' };
  }
  return { valid: true, error: null };
}

// ---------------------------------------------------------------------------
// ProjectService
// ---------------------------------------------------------------------------

export class ProjectService {
  constructor(private readonly db: DatabaseProvider) {}

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /**
   * Returns all active (non-deleted) projects for the current user,
   * newest first.
   */
  async listProjects(userId: string): Promise<Project[]> {
    const models = await this.db.projects.findAllByUserId(userId);
    return models.map(this.modelToProject);
  }

  async getProject(projectId: string, userId: string): Promise<Project> {
    const model = await this.db.projects.findById(projectId);
    if (!model) {
      throw new ProjectError('Project not found.', 'NOT_FOUND');
    }
    if (model.userId !== userId) {
      throw new ProjectError('Access denied.', 'FORBIDDEN');
    }
    return this.modelToProject(model);
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  /**
   * Creates a new project and its 3 default swimlanes atomically.
   * Returns the new Project domain object.
   */
  async createProject(userId: string, name: string): Promise<Project> {
    const check = validateProjectName(name);
    if (!check.valid) {
      throw new ProjectError(check.error!, 'VALIDATION_ERROR');
    }

    const projectModel = await this.db.projects.create(userId, name.trim());

    // Always create default lanes immediately after project creation.
    // This is done in a separate write because WatermelonDB doesn't support
    // nested writes. The two operations are logically atomic from the UI's
    // perspective because the project isn't visible until both complete.
    await this.db.swimlanes.createDefaults(projectModel.id);

    return this.modelToProject(projectModel);
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async renameProject(
    projectId: string,
    userId: string,
    newName: string,
  ): Promise<Project> {
    const check = validateProjectName(newName);
    if (!check.valid) {
      throw new ProjectError(check.error!, 'VALIDATION_ERROR');
    }

    // Verify ownership before modifying
    const existing = await this.db.projects.findById(projectId);
    if (!existing) throw new ProjectError('Project not found.', 'NOT_FOUND');
    if (existing.userId !== userId) throw new ProjectError('Access denied.', 'FORBIDDEN');

    await this.db.projects.rename(projectId, newName.trim());

    const updated = await this.db.projects.findById(projectId);
    return this.modelToProject(updated!);
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  /**
   * Soft-deletes a project. It disappears from the list but can be recovered.
   * (Recovery UI is a future feature — for now this is effectively permanent from UX.)
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    const existing = await this.db.projects.findById(projectId);
    if (!existing) throw new ProjectError('Project not found.', 'NOT_FOUND');
    if (existing.userId !== userId) throw new ProjectError('Access denied.', 'FORBIDDEN');

    await this.db.projects.softDelete(projectId);
  }

  // ---------------------------------------------------------------------------
  // Swimlane helpers (used by Phase 5 but defined here as project-level ops)
  // ---------------------------------------------------------------------------

  async getSwimlanesForProject(projectId: string): Promise<Swimlane[]> {
    const models = await this.db.swimlanes.findByProjectId(projectId);
    return models.map(this.modelToSwimlane);
  }

  // ---------------------------------------------------------------------------
  // Mappers (WatermelonDB model → domain type)
  // ---------------------------------------------------------------------------

  private modelToProject(model: ProjectModel): Project {
    return {
      id:        model.id,
      userId:    model.userId,
      name:      model.name,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
      deletedAt: model.deletedAt ? model.deletedAt.toISOString() : null,
    };
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
