/**
 * SwimlaneRepository
 *
 * Database operations for `swimlanes`.
 */

import { Database, Q } from '@nozbe/watermelondb';
import { DEFAULT_LANES } from '@kanban/types';
import { SwimlaneModel } from '../models/SwimlaneModel';
import { CardModel } from '../models/CardModel';

export class SwimlaneRepository {
  constructor(private readonly db: Database) {}

  async findByProjectId(projectId: string): Promise<SwimlaneModel[]> {
    const lanes = await this.db
      .get<SwimlaneModel>('swimlanes')
      .query(Q.where('project_id', Q.eq(projectId)))
      .fetch();

    // Sort by position integer
    return lanes.sort((a, b) => a.position - b.position);
  }

  async findById(id: string): Promise<SwimlaneModel | null> {
    try {
      return await this.db.get<SwimlaneModel>('swimlanes').find(id);
    } catch {
      return null;
    }
  }

  async createDefaults(projectId: string): Promise<SwimlaneModel[]> {
    const now = Date.now();

    return this.db.write(async () => {
      const created: SwimlaneModel[] = [];

      for (let i = 0; i < DEFAULT_LANES.length; i++) {
        const lane = DEFAULT_LANES[i]!;
        const model = await this.db.get<SwimlaneModel>('swimlanes').create((record) => {
          record.projectId = projectId;
          record.name      = lane.name;
          record.color     = lane.color;
          record.position  = i;
          (record._raw as Record<string, unknown>)['created_at'] = now;
          (record._raw as Record<string, unknown>)['updated_at'] = now;
        });
        created.push(model);
      }

      return created;
    });
  }

  async create(
    projectId: string,
    name: string,
    color: string,
    position: number,
  ): Promise<SwimlaneModel> {
    const now = Date.now();

    return this.db.write(async () =>
      this.db.get<SwimlaneModel>('swimlanes').create((record) => {
        record.projectId = projectId;
        record.name      = name;
        record.color     = color;
        record.position  = position;
        (record._raw as Record<string, unknown>)['created_at'] = now;
        (record._raw as Record<string, unknown>)['updated_at'] = now;
      }),
    );
  }

  async update(
    laneId: string,
    patch: Partial<{ name: string; color: string; position: number }>,
  ): Promise<void> {
    const lane = await this.db.get<SwimlaneModel>('swimlanes').find(laneId);

    await this.db.write(async () => {
      await lane.update((record) => {
        if (patch.name     !== undefined) record.name     = patch.name;
        if (patch.color    !== undefined) record.color    = patch.color;
        if (patch.position !== undefined) record.position = patch.position;
        (record._raw as Record<string, unknown>)['updated_at'] = Date.now();
      });
    });
  }

  async delete(laneId: string): Promise<void> {
    const lane = await this.db.get<SwimlaneModel>('swimlanes').find(laneId);
    
    // Cascading deletion — grab all cards belonging to this lane
    const cards = await this.db.get<CardModel>('cards').query(Q.where('lane_id', laneId)).fetch();

    await this.db.write(async () => {
      const cardDeletions = cards.map((c) => c.prepareDestroyPermanently());
      await this.db.batch(
        lane.prepareDestroyPermanently(),
        ...cardDeletions
      );
    });
  }
}