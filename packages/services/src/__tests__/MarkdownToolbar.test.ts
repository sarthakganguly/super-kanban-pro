/**
 * MarkdownToolbar tests
 *
 * applyToolbarAction is pure logic with no React or DOM dependencies.
 * Tests cover: wrap selection, insert template, edge cases.
 */

import { applyToolbarAction, TOOLBAR_ACTIONS } from '../../../packages/ui/src/components/markdown/MarkdownToolbar';

const boldAction    = TOOLBAR_ACTIONS.find((a) => a.label === 'B')!;
const italicAction  = TOOLBAR_ACTIONS.find((a) => a.label === 'I')!;
const codeAction    = TOOLBAR_ACTIONS.find((a) => a.label === '`')!;
const h1Action      = TOOLBAR_ACTIONS.find((a) => a.label === 'H1')!;
const bulletAction  = TOOLBAR_ACTIONS.find((a) => a.label === '•')!;
const linkAction    = TOOLBAR_ACTIONS.find((a) => a.label === '[]')!;

describe('applyToolbarAction', () => {

  // ---------------------------------------------------------------------------
  // Wrap selection
  // ---------------------------------------------------------------------------

  it('wraps selected text with bold markers', () => {
    const result = applyToolbarAction(
      'hello world',
      { start: 6, end: 11 },
      boldAction,
    );
    expect(result).toBe('hello **world**');
  });

  it('wraps selected text with italic markers', () => {
    const result = applyToolbarAction(
      'click here for info',
      { start: 6, end: 10 },
      italicAction,
    );
    expect(result).toBe('click *here* for info');
  });

  it('wraps selected text with inline code markers', () => {
    const result = applyToolbarAction(
      'run the command now',
      { start: 8, end: 15 },
      codeAction,
    );
    expect(result).toBe('run the `command` now');
  });

  it('wraps link: selected text becomes link label', () => {
    const result = applyToolbarAction(
      'Visit GitHub today',
      { start: 6, end: 12 },
      linkAction,
    );
    expect(result).toBe('Visit [GitHub](url) today');
  });

  // ---------------------------------------------------------------------------
  // Insert at cursor (empty selection)
  // ---------------------------------------------------------------------------

  it('inserts bold template at cursor when nothing selected', () => {
    const result = applyToolbarAction(
      'hello ',
      { start: 6, end: 6 },
      boldAction,
    );
    expect(result).toBe('hello **bold text**');
  });

  it('inserts H1 prefix at cursor', () => {
    const result = applyToolbarAction(
      '',
      { start: 0, end: 0 },
      h1Action,
    );
    expect(result).toBe('# Heading');
  });

  it('inserts bullet template at cursor', () => {
    const result = applyToolbarAction(
      'notes:\n',
      { start: 7, end: 7 },
      bulletAction,
    );
    expect(result).toBe('notes:\n- Item');
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it('handles wrapping entire string', () => {
    const result = applyToolbarAction(
      'entire text',
      { start: 0, end: 11 },
      boldAction,
    );
    expect(result).toBe('**entire text**');
  });

  it('handles empty string with empty selection', () => {
    const result = applyToolbarAction(
      '',
      { start: 0, end: 0 },
      italicAction,
    );
    expect(result).toBe('*italic text*');
  });

  it('preserves text before and after cursor when inserting', () => {
    const result = applyToolbarAction(
      'before  after',
      { start: 7, end: 7 },
      codeAction,
    );
    expect(result).toBe('before `code` after');
  });

  it('all TOOLBAR_ACTIONS have required fields', () => {
    for (const action of TOOLBAR_ACTIONS) {
      expect(typeof action.label).toBe('string');
      expect(typeof action.hint).toBe('string');
      expect(typeof action.prefix).toBe('string');
    }
  });
});
