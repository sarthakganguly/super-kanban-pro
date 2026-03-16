/**
 * FlatList performance configuration tests
 */

import {
  CARD_SLOT_HEIGHT,
  FLATLIST_PERF_AGGRESSIVE,
  FLATLIST_PERF_BALANCED,
  FLATLIST_PERF_GENEROUS,
  getCardItemLayout,
  selectFlatListPreset,
} from '../performance/flatListConfig';

describe('selectFlatListPreset', () => {
  it('returns aggressive preset for >= 200 cards', () => {
    expect(selectFlatListPreset(200)).toBe(FLATLIST_PERF_AGGRESSIVE);
    expect(selectFlatListPreset(500)).toBe(FLATLIST_PERF_AGGRESSIVE);
    expect(selectFlatListPreset(5000)).toBe(FLATLIST_PERF_AGGRESSIVE);
  });

  it('returns balanced preset for 50–199 cards', () => {
    expect(selectFlatListPreset(50)).toBe(FLATLIST_PERF_BALANCED);
    expect(selectFlatListPreset(100)).toBe(FLATLIST_PERF_BALANCED);
    expect(selectFlatListPreset(199)).toBe(FLATLIST_PERF_BALANCED);
  });

  it('returns generous preset for < 50 cards', () => {
    expect(selectFlatListPreset(0)).toBe(FLATLIST_PERF_GENEROUS);
    expect(selectFlatListPreset(1)).toBe(FLATLIST_PERF_GENEROUS);
    expect(selectFlatListPreset(49)).toBe(FLATLIST_PERF_GENEROUS);
  });

  it('aggressive has smaller windowSize than generous', () => {
    expect(FLATLIST_PERF_AGGRESSIVE.windowSize).toBeLessThan(
      FLATLIST_PERF_GENEROUS.windowSize,
    );
  });

  it('aggressive has smaller maxToRenderPerBatch than generous', () => {
    expect(FLATLIST_PERF_AGGRESSIVE.maxToRenderPerBatch).toBeLessThan(
      FLATLIST_PERF_GENEROUS.maxToRenderPerBatch,
    );
  });
});

describe('getCardItemLayout', () => {
  it('returns correct offset for index 0', () => {
    const layout = getCardItemLayout(null, 0);
    expect(layout.offset).toBe(0);
    expect(layout.length).toBe(CARD_SLOT_HEIGHT);
    expect(layout.index).toBe(0);
  });

  it('returns correct offset for index n', () => {
    const layout = getCardItemLayout(null, 5);
    expect(layout.offset).toBe(CARD_SLOT_HEIGHT * 5);
    expect(layout.index).toBe(5);
  });

  it('offset is cumulative (each item adds CARD_SLOT_HEIGHT)', () => {
    const items = [0, 1, 2, 3, 4].map((i) => getCardItemLayout(null, i));
    for (let i = 1; i < items.length; i++) {
      expect(items[i]!.offset - items[i - 1]!.offset).toBe(CARD_SLOT_HEIGHT);
    }
  });
});
