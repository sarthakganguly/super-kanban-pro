/**
 * SettingsService tests
 */

import { SettingsService } from '../settings/SettingsService';
import type { DatabaseProvider } from '@kanban/database';

const USER_ID   = 'user-1';
const CONFIG_ID = 'config-1';

function makeConfigModel(overrides = {}) {
  return {
    id:                   CONFIG_ID,
    userId:               USER_ID,
    themeMode:            'system',
    fontFamily:           'System',
    fontSize:             15,
    defaultSwimlanes:     ['To Do', 'In Progress', 'Done'],
    defaultLaneColors:    ['#6B7280', '#3B82F6', '#10B981'],
    defaultSwimlanesJson: JSON.stringify(['To Do', 'In Progress', 'Done']),
    defaultLaneColorsJson: JSON.stringify(['#6B7280', '#3B82F6', '#10B981']),
    imageMaxSizeMb:       2,
    markdownDefault:      true,
    enableSync:           false,
    syncEndpoint:         null,
    createdAt:            new Date(),
    updatedAt:            new Date(),
    ...overrides,
  };
}

function makeMockDb(configOverrides = {}): DatabaseProvider {
  return {
    db:        {} as never,
    projects:  {} as never,
    swimlanes: {} as never,
    cards:     {} as never,
    attachments: {} as never,
    users: {
      findConfigByUserId: jest.fn().mockResolvedValue(makeConfigModel(configOverrides)),
      updateConfig:       jest.fn().mockResolvedValue(undefined),
      create:             jest.fn(),
      findByUsername:     jest.fn(),
      findById:           jest.fn(),
      findAll:            jest.fn(),
      delete:             jest.fn(),
    },
  };
}

describe('SettingsService.getSettings', () => {
  it('returns a typed snapshot for a valid user', async () => {
    const db  = makeMockDb();
    const svc = new SettingsService(db);
    const s   = await svc.getSettings(USER_ID);

    expect(s).not.toBeNull();
    expect(s!.themeMode).toBe('system');
    expect(s!.defaultSwimlanes).toEqual(['To Do', 'In Progress', 'Done']);
    expect(s!.imageMaxSizeMb).toBe(2);
  });

  it('returns null when no config exists', async () => {
    const db = makeMockDb();
    (db.users.findConfigByUserId as jest.Mock).mockResolvedValue(null);
    const svc = new SettingsService(db);
    expect(await svc.getSettings(USER_ID)).toBeNull();
  });
});

describe('SettingsService.setThemeMode', () => {
  it('calls updateConfig with the correct theme mode', async () => {
    const db  = makeMockDb();
    const svc = new SettingsService(db);
    await svc.setThemeMode(CONFIG_ID, 'dark');
    expect(db.users.updateConfig).toHaveBeenCalledWith(CONFIG_ID, { themeMode: 'dark' });
  });
});

describe('SettingsService.setFontSize', () => {
  it('saves a valid font size', async () => {
    const db  = makeMockDb();
    const svc = new SettingsService(db);
    await svc.setFontSize(CONFIG_ID, 17);
    expect(db.users.updateConfig).toHaveBeenCalledWith(CONFIG_ID, { fontSize: 17 });
  });

  it('throws for out-of-range font size', async () => {
    const db  = makeMockDb();
    const svc = new SettingsService(db);
    await expect(svc.setFontSize(CONFIG_ID, 9)).rejects.toThrow('out of range');
    await expect(svc.setFontSize(CONFIG_ID, 25)).rejects.toThrow('out of range');
  });
});

describe('SettingsService.setDefaultSwimlanes', () => {
  it('JSON-serializes names and colors', async () => {
    const db  = makeMockDb();
    const svc = new SettingsService(db);
    await svc.setDefaultSwimlanes(CONFIG_ID, ['Backlog', 'Done'], ['#000', '#fff']);
    expect(db.users.updateConfig).toHaveBeenCalledWith(CONFIG_ID, {
      defaultSwimlanesJson:   JSON.stringify(['Backlog', 'Done']),
      defaultLaneColorsJson:  JSON.stringify(['#000', '#fff']),
    });
  });

  it('throws when names and colors arrays differ in length', async () => {
    const db  = makeMockDb();
    const svc = new SettingsService(db);
    await expect(svc.setDefaultSwimlanes(CONFIG_ID, ['A', 'B'], ['#000'])).rejects.toThrow('same length');
  });

  it('throws when no lanes are provided', async () => {
    const db  = makeMockDb();
    const svc = new SettingsService(db);
    await expect(svc.setDefaultSwimlanes(CONFIG_ID, [], [])).rejects.toThrow('At least one');
  });
});

describe('SettingsService.setImageMaxSizeMb', () => {
  it('saves valid image size', async () => {
    const db  = makeMockDb();
    const svc = new SettingsService(db);
    await svc.setImageMaxSizeMb(CONFIG_ID, 5);
    expect(db.users.updateConfig).toHaveBeenCalledWith(CONFIG_ID, { imageMaxSizeMb: 5 });
  });

  it('throws for out-of-range values', async () => {
    const db  = makeMockDb();
    const svc = new SettingsService(db);
    await expect(svc.setImageMaxSizeMb(CONFIG_ID, 0.1)).rejects.toThrow('out of range');
    await expect(svc.setImageMaxSizeMb(CONFIG_ID, 51)).rejects.toThrow('out of range');
  });
});

describe('SettingsService.resetToDefaults', () => {
  it('calls updateConfig with all default values', async () => {
    const db  = makeMockDb();
    const svc = new SettingsService(db);
    await svc.resetToDefaults(CONFIG_ID);

    expect(db.users.updateConfig).toHaveBeenCalledWith(
      CONFIG_ID,
      expect.objectContaining({
        themeMode:      'system',
        fontFamily:     'System',
        fontSize:       15,
        imageMaxSizeMb: 2,
        enableSync:     false,
        syncEndpoint:   null,
      }),
    );
  });
});
