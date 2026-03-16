/**
 * CardService tests
 */

import { CardError, CardService } from '../card/CardService';
import type { DatabaseProvider } from '@kanban/database';

const LANE_ID = 'lane-1';
const CARD_ID = 'card-1';

function makeCardModel(overrides = {}) {
  return {
    id:                  CARD_ID,
    laneId:              LANE_ID,
    title:               'Test card',
    descriptionMarkdown: '',
    color:               null,
    statusColor:         null,
    dueDate:             null,
    positionIndex:       '1',
    createdAt:           new Date('2024-01-01'),
    updatedAt:           new Date('2024-01-01'),
    deletedAt:           null,
    isDeleted:           false,
    isOverdue:           false,
    ...overrides,
  };
}

function makeMockDb(cardOverrides = {}): DatabaseProvider {
  return {
    db:        {} as never,
    users:     {} as never,
    projects:  {} as never,
    swimlanes: {} as never,
    cards: {
      findByLaneId:  jest.fn().mockResolvedValue([]),
      findByLaneIds: jest.fn().mockResolvedValue(new Map()),
      findById:      jest.fn().mockResolvedValue(null),
      create:        jest.fn().mockResolvedValue(makeCardModel()),
      update:        jest.fn().mockResolvedValue(undefined),
      move:          jest.fn().mockResolvedValue(undefined),
      softDelete:    jest.fn().mockResolvedValue(undefined),
      rebalanceLane: jest.fn().mockResolvedValue(undefined),
      ...cardOverrides,
    },
  };
}

// ---------------------------------------------------------------------------
// createCard
// ---------------------------------------------------------------------------

describe('CardService.createCard', () => {
  it('creates a card with valid input', async () => {
    const db  = makeMockDb();
    const svc = new CardService(db);

    const card = await svc.createCard({ laneId: LANE_ID, title: 'New task' });

    expect(db.cards.create).toHaveBeenCalledWith(
      expect.objectContaining({ laneId: LANE_ID, title: 'New task' }),
    );
    expect(card.laneId).toBe(LANE_ID);
  });

  it('trims title whitespace', async () => {
    const db  = makeMockDb();
    const svc = new CardService(db);

    await svc.createCard({ laneId: LANE_ID, title: '  padded  ' });

    expect(db.cards.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'padded' }),
    );
  });

  it('throws VALIDATION_ERROR for empty title', async () => {
    const db  = makeMockDb();
    const svc = new CardService(db);

    await expect(svc.createCard({ laneId: LANE_ID, title: '' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect(db.cards.create).not.toHaveBeenCalled();
  });

  it('throws VALIDATION_ERROR for title over 200 chars', async () => {
    const db  = makeMockDb();
    const svc = new CardService(db);

    await expect(svc.createCard({ laneId: LANE_ID, title: 'x'.repeat(201) }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('converts ISO dueDate to ms epoch for the repository', async () => {
    const db  = makeMockDb();
    const svc = new CardService(db);

    const iso = '2025-06-15T12:00:00.000Z';
    await svc.createCard({ laneId: LANE_ID, title: 'Dated', dueDate: iso });

    expect(db.cards.create).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: new Date(iso).getTime() }),
    );
  });
});

// ---------------------------------------------------------------------------
// updateCard
// ---------------------------------------------------------------------------

describe('CardService.updateCard', () => {
  it('updates allowed fields', async () => {
    const model = makeCardModel();
    const db    = makeMockDb({
      findById: jest.fn()
        .mockResolvedValueOnce(model)  // existence check
        .mockResolvedValueOnce({ ...model, title: 'Updated' }),  // re-fetch
    });
    const svc = new CardService(db);

    const result = await svc.updateCard(CARD_ID, { title: 'Updated' });

    expect(db.cards.update).toHaveBeenCalledWith(
      CARD_ID,
      expect.objectContaining({ title: 'Updated' }),
    );
    expect(result.title).toBe('Updated');
  });

  it('throws NOT_FOUND for unknown card', async () => {
    const db  = makeMockDb({ findById: jest.fn().mockResolvedValue(null) });
    const svc = new CardService(db);

    await expect(svc.updateCard('ghost', { title: 'X' }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ---------------------------------------------------------------------------
// moveCard
// ---------------------------------------------------------------------------

describe('CardService.moveCard', () => {
  it('calls repository move with correct args', async () => {
    const model = makeCardModel();
    const db    = makeMockDb({ findById: jest.fn().mockResolvedValue(model) });
    const svc   = new CardService(db);

    await svc.moveCard({
      cardId: CARD_ID,
      targetLaneId: 'lane-2',
      prevCardId: null,
      nextCardId: 'card-2',
    });

    expect(db.cards.move).toHaveBeenCalledWith(
      CARD_ID, 'lane-2', null, 'card-2',
    );
  });

  it('throws NOT_FOUND for unknown card', async () => {
    const db  = makeMockDb({ findById: jest.fn().mockResolvedValue(null) });
    const svc = new CardService(db);

    await expect(svc.moveCard({
      cardId: 'ghost',
      targetLaneId: 'lane-1',
      prevCardId: null,
      nextCardId: null,
    })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ---------------------------------------------------------------------------
// deleteCard
// ---------------------------------------------------------------------------

describe('CardService.deleteCard', () => {
  it('soft-deletes an existing card', async () => {
    const model = makeCardModel();
    const db    = makeMockDb({ findById: jest.fn().mockResolvedValue(model) });
    const svc   = new CardService(db);

    await svc.deleteCard(CARD_ID);

    expect(db.cards.softDelete).toHaveBeenCalledWith(CARD_ID);
  });

  it('throws NOT_FOUND for unknown card', async () => {
    const db  = makeMockDb({ findById: jest.fn().mockResolvedValue(null) });
    const svc = new CardService(db);

    await expect(svc.deleteCard('ghost'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
