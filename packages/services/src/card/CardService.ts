/**
 * CardService
 *
 * Business logic for card management.
 *
 * Key design choices:
 *   - Cards are mapped to a `BoardCard` type (superset of Card) that includes
 *     the lane ID so the board UI can group them without extra queries.
 *   - Move operations delegate entirely to CardRepository.move() which handles
 *     fractional index calculation atomically.
 *   - Markdown is stored as-is; rendering happens in the UI layer (Phase 7).
 *   - Due date is stored as ms epoch in WatermelonDB; we convert to/from ISO
 *     strings at the service boundary so the UI always sees ISO strings.
 */

import type { DatabaseProvider, CardModel } from '@kanban/database';
import type { Card } from '@kanban/types';

export class CardError extends Error {
  constructor(
    message: string,
    public readonly code: 'VALIDATION_ERROR' | 'NOT_FOUND',
  ) {
    super(message);
    this.name = 'CardError';
  }
}

// ---------------------------------------------------------------------------
// Input types (service boundary — callers use these, not raw DB types)
// ---------------------------------------------------------------------------

export interface CreateCardInput {
  laneId: string;
  title: string;
  descriptionMarkdown?: string;
  color?: string | null;
  statusColor?: string | null;
  dueDate?: string | null;   // ISO string from UI
}

export interface UpdateCardInput {
  title?: string;
  descriptionMarkdown?: string;
  color?: string | null;
  statusColor?: string | null;
  dueDate?: string | null;   // ISO string from UI, or null to clear
}

export interface MoveCardInput {
  cardId: string;
  targetLaneId: string;
  prevCardId: string | null;
  nextCardId: string | null;
}

// ---------------------------------------------------------------------------
// CardService
// ---------------------------------------------------------------------------

export class CardService {
  constructor(private readonly db: DatabaseProvider) {}

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /**
   * Loads all cards for a project in a single query, grouped by lane.
   * Returns a Map<laneId, Card[]> sorted by position within each lane.
   * This is the primary read for rendering the full board.
   */
  async getCardsForProject(
    laneIds: string[],
  ): Promise<Map<string, Card[]>> {
    const modelMap = await this.db.cards.findByLaneIds(laneIds);
    const result   = new Map<string, Card[]>();
    for (const [laneId, models] of modelMap) {
      result.set(laneId, models.map(this.modelToCard));
    }
    return result;
  }

  async getCard(cardId: string): Promise<Card> {
    const model = await this.db.cards.findById(cardId);
    if (!model) throw new CardError('Card not found.', 'NOT_FOUND');
    return this.modelToCard(model);
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  async createCard(input: CreateCardInput): Promise<Card> {
    if (!input.title.trim()) {
      throw new CardError('Card title cannot be empty.', 'VALIDATION_ERROR');
    }
    if (input.title.length > 200) {
      throw new CardError('Title must be 200 characters or fewer.', 'VALIDATION_ERROR');
    }

    const model = await this.db.cards.create({
      laneId:              input.laneId,
      title:               input.title.trim(),
      descriptionMarkdown: input.descriptionMarkdown ?? '',
      color:               input.color ?? null,
      statusColor:         input.statusColor ?? null,
      dueDate:             input.dueDate ? new Date(input.dueDate).getTime() : null,
    });

    return this.modelToCard(model);
  }

  async updateCard(cardId: string, input: UpdateCardInput): Promise<Card> {
    const existing = await this.db.cards.findById(cardId);
    if (!existing) throw new CardError('Card not found.', 'NOT_FOUND');

    if (input.title !== undefined && !input.title.trim()) {
      throw new CardError('Card title cannot be empty.', 'VALIDATION_ERROR');
    }

    await this.db.cards.update(cardId, {
      title:               input.title?.trim(),
      descriptionMarkdown: input.descriptionMarkdown,
      color:               input.color,
      statusColor:         input.statusColor,
      dueDate:             input.dueDate !== undefined
        ? (input.dueDate ? new Date(input.dueDate).getTime() : null)
        : undefined,
    });

    const updated = await this.db.cards.findById(cardId);
    return this.modelToCard(updated!);
  }

  /**
   * Moves a card within or between lanes.
   * prevCardId / nextCardId define the insertion point:
   *   - Both null → insert at top of target lane (becomes first card)
   *   - prevCardId only → insert after that card (at bottom if last)
   *   - Both set → insert between those two cards
   */
  async moveCard(input: MoveCardInput): Promise<void> {
    const existing = await this.db.cards.findById(input.cardId);
    if (!existing) throw new CardError('Card not found.', 'NOT_FOUND');

    await this.db.cards.move(
      input.cardId,
      input.targetLaneId,
      input.prevCardId,
      input.nextCardId,
    );
  }

  async deleteCard(cardId: string): Promise<void> {
    const existing = await this.db.cards.findById(cardId);
    if (!existing) throw new CardError('Card not found.', 'NOT_FOUND');
    await this.db.cards.softDelete(cardId);
  }

  // ---------------------------------------------------------------------------
  // Mapper
  // ---------------------------------------------------------------------------

  private modelToCard(model: CardModel): Card {
    return {
      id:                  model.id,
      laneId:              model.laneId,
      title:               model.title,
      descriptionMarkdown: model.descriptionMarkdown,
      color:               model.color,
      statusColor:         model.statusColor,
      dueDate:             model.dueDate ? model.dueDate.toISOString() : null,
      positionIndex:       model.positionIndex,
      createdAt:           model.createdAt.toISOString(),
      updatedAt:           model.updatedAt.toISOString(),
      deletedAt:           model.deletedAt ? model.deletedAt.toISOString() : null,
    };
  }
}
