/**
 * CardRepository
 *
 * Database operations for `cards`.
 *
 * Performance design:
 *   - Queries filter `deleted_at IS NULL` to exclude soft-deleted cards.
 *   - Cards are sorted by `position_index` (string sort — works correctly
 *     because fractional indices are always positive numbers, so lexicographic
 *     order matches numeric order for same-integer-part values).
 *     For safety, numeric sort is done in-memory after fetching.
 *   - Batch moves (drag-and-drop) use db.batch() to apply all position
 *     updates in a single write transaction.
 */

import { Database, Q } from '@nozbe/watermelondb';
import { computeFractionalIndex, sortByPosition } from '@kanban/utils';
import { CardModel } from '../models/CardModel';

interface CreateCardInput {
  laneId: string;
  title: string;
  descriptionMarkdown?: string;
  color?: string | null;
  statusColor?: string | null;
  dueDate?: number | null;    // ms epoch
}

interface UpdateCardInput {
  title?: string;
  descriptionMarkdown?: string;
  color?: string | null;
  statusColor?: string | null;
  dueDate?: number | null;
}

export class CardRepository {
  constructor(private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /**
   * Fetch all active cards in a lane, sorted by fractional position index.
   * This is the primary query for rendering a swimlane column.
   */
  async findByLaneId(laneId: string): Promise<CardModel[]> {
    const cards = await this.db
      .get<CardModel>('cards')
      .query(
        Q.and(
          Q.where('lane_id', Q.eq(laneId)),
          Q.where('deleted_at', Q.eq(null)),
        ),
      )
      .fetch();

    // In-memory sort by numeric value of position_index
    // Avoids relying on SQLite/IndexedDB string sort correctness
    return sortByPosition(cards);
  }

  /**
   * Fetch multiple lanes' cards in one query — used by the board view
   * to load all columns for a project at once.
   */
  async findByLaneIds(laneIds: string[]): Promise<Map<string, CardModel[]>> {
    if (laneIds.length === 0) return new Map();

    const cards = await this.db
      .get<CardModel>('cards')
      .query(
        Q.and(
          Q.where('lane_id', Q.oneOf(laneIds)),
          Q.where('deleted_at', Q.eq(null)),
        ),
      )
      .fetch();

    // Group and sort per lane
    const grouped = new Map<string, CardModel[]>();
    for (const laneId of laneIds) {
      grouped.set(laneId,[]);
    }
    for (const card of cards) {
      grouped.get(card.laneId)?.push(card);
    }
    for (const [laneId, laneCards] of grouped) {
      grouped.set(laneId, sortByPosition(laneCards));
    }
    return grouped;
  }

  async findById(id: string): Promise<CardModel | null> {
    try {
      const card = await this.db.get<CardModel>('cards').find(id);
      return card.isDeleted ? null : card;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  /**
   * Creates a card at the TOP of the given lane.
   * Position index is computed between 'null' (start) and the current first card.
   */
  async create(input: CreateCardInput): Promise<CardModel> {
    const existingCards = await this.findByLaneId(input.laneId);
    
    // Grab the current first card (if any) to calculate the insertion position
    const firstCard = existingCards[0];

    const positionIndex = computeFractionalIndex(
      null, // No previous card (inserting at the very beginning)
      firstCard?.positionIndex ?? null, // The current first card gets pushed down
    );

    const now = Date.now();

    return this.db.write(async () =>
      this.db.get<CardModel>('cards').create((record) => {
        record.laneId              = input.laneId;
        record.title               = input.title;
        record.descriptionMarkdown = input.descriptionMarkdown ?? '';
        record.color               = input.color ?? null;
        record.statusColor         = input.statusColor ?? null;
        record.positionIndex       = positionIndex;
        (record._raw as Record<string, unknown>)['due_date']   = input.dueDate ?? null;
        (record._raw as Record<string, unknown>)['created_at'] = now;
        (record._raw as Record<string, unknown>)['updated_at'] = now;
        (record._raw as Record<string, unknown>)['deleted_at'] = null;
      }),
    );
  }

  async update(cardId: string, input: UpdateCardInput): Promise<void> {
    const card = await this.db.get<CardModel>('cards').find(cardId);

    await this.db.write(async () => {
      await card.update((record) => {
        if (input.title               !== undefined) record.title               = input.title;
        if (input.descriptionMarkdown !== undefined) record.descriptionMarkdown = input.descriptionMarkdown;
        if (input.color               !== undefined) record.color               = input.color;
        if (input.statusColor         !== undefined) record.statusColor         = input.statusColor;
        if (input.dueDate             !== undefined) {
          (record._raw as Record<string, unknown>)['due_date'] = input.dueDate;
        }
        (record._raw as Record<string, unknown>)['updated_at'] = Date.now();
      });
    });
  }

  /**
   * Moves a card to a position between `prevCardId` and `nextCardId`.
   * Pass null for prevCardId to insert at the top, null for nextCardId for bottom.
   * Can also move to a different lane by passing a new laneId.
   *
   * Uses a single write transaction so the UI never sees a partial update.
   */
  async move(
    cardId: string,
    targetLaneId: string,
    prevCardId: string | null,
    nextCardId: string | null,
  ): Promise<void> {
    // Resolve prev/next position indices
    const prevIndex = prevCardId
      ? (await this.db.get<CardModel>('cards').find(prevCardId)).positionIndex
      : null;
    const nextIndex = nextCardId
      ? (await this.db.get<CardModel>('cards').find(nextCardId)).positionIndex
      : null;

    const newIndex = computeFractionalIndex(prevIndex, nextIndex);

    const card = await this.db.get<CardModel>('cards').find(cardId);

    await this.db.write(async () => {
      await card.update((record) => {
        record.laneId        = targetLaneId;
        record.positionIndex = newIndex;
        (record._raw as Record<string, unknown>)['updated_at'] = Date.now();
      });
    });
  }

  /** Soft delete */
  async softDelete(cardId: string): Promise<void> {
    const card = await this.db.get<CardModel>('cards').find(cardId);

    await this.db.write(async () => {
      await card.update((record) => {
        (record._raw as Record<string, unknown>)['deleted_at'] = Date.now();
        (record._raw as Record<string, unknown>)['updated_at'] = Date.now();
      });
    });
  }

  /**
   * Rebalances all cards in a lane back to integer indices.
   * Call this when a lane's indices have drifted to extreme floating-point precision
   * after thousands of moves (Phase 10 will add automatic triggering).
   */
  async rebalanceLane(laneId: string): Promise<void> {
    const cards = await this.findByLaneId(laneId);
    const now   = Date.now();

    await this.db.write(async () => {
      const updates = cards.map((card, index) =>
        card.prepareUpdate((record) => {
          record.positionIndex = String(index + 1);
          (record._raw as Record<string, unknown>)['updated_at'] = now;
        }),
      );
      await this.db.batch(...updates);
    });
  }
}