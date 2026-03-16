/**
 * MarkdownRenderer
 *
 * Renders a markdown string as styled output.
 *
 * Platform strategy:
 *   Web — uses react-markdown with remark-gfm (GitHub Flavored Markdown).
 *         react-markdown renders to DOM elements which React Native Web
 *         handles via its HTML shim.
 *
 *   Native — uses a custom inline parser that converts markdown syntax to
 *         React Native Text components with appropriate styles. Supports:
 *         **bold**, *italic*, `code`, # headings, > blockquote,
 *         - bullet lists, [links](url), ~~strikethrough~~
 *
 * Why not react-native-render-html on native?
 *   react-native-render-html requires a WebView for full fidelity and adds
 *   ~2MB to the bundle. Our markdown is structured (card descriptions) and
 *   never arbitrary HTML — so a focused parser is lighter and faster.
 *
 * Usage:
 *   <MarkdownRenderer content={card.descriptionMarkdown} />
 */

import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarkdownRendererProps {
  content: string;
  /** Max lines before truncating (used in card preview) */
  maxLines?: number;
  /** Whether to show the full scrollable document (detail screen) */
  scrollable?: boolean;
}

// ---------------------------------------------------------------------------
// Web renderer — react-markdown
// Only imported on web builds via conditional require
// ---------------------------------------------------------------------------

function WebMarkdownRenderer({ content }: { content: string }) {
  const theme = useTheme();

  // Dynamic require so Metro doesn't bundle react-markdown on native
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ReactMarkdown = require('react-markdown').default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const remarkGfm = require('remark-gfm').default;

  const mdStyles: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: 14,
    lineHeight: 1.65,
    color: theme.colors.textPrimary,
    wordBreak: 'break-word',
  };

  return (
    <div style={mdStyles}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }: { children: React.ReactNode }) => (
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: theme.colors.textPrimary }}>{children}</h1>
          ),
          h2: ({ children }: { children: React.ReactNode }) => (
            <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 6, color: theme.colors.textPrimary }}>{children}</h2>
          ),
          h3: ({ children }: { children: React.ReactNode }) => (
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: theme.colors.textPrimary }}>{children}</h3>
          ),
          p: ({ children }: { children: React.ReactNode }) => (
            <p style={{ marginBottom: 10, color: theme.colors.textPrimary }}>{children}</p>
          ),
          code: ({ inline, children }: { inline?: boolean; children: React.ReactNode }) =>
            inline ? (
              <code style={{
                fontFamily: 'monospace',
                fontSize: 12,
                backgroundColor: theme.colors.bgTertiary,
                color: theme.colors.accent,
                padding: '1px 5px',
                borderRadius: 4,
              }}>{children}</code>
            ) : (
              <pre style={{
                backgroundColor: theme.colors.bgTertiary,
                padding: 12,
                borderRadius: 8,
                overflow: 'auto',
                fontSize: 12,
                fontFamily: 'monospace',
                lineHeight: 1.5,
              }}>
                <code style={{ color: theme.colors.textPrimary }}>{children}</code>
              </pre>
            ),
          blockquote: ({ children }: { children: React.ReactNode }) => (
            <blockquote style={{
              borderLeft: `3px solid ${theme.colors.accent}`,
              paddingLeft: 12,
              marginLeft: 0,
              color: theme.colors.textSecondary,
              fontStyle: 'italic',
            }}>{children}</blockquote>
          ),
          ul: ({ children }: { children: React.ReactNode }) => (
            <ul style={{ paddingLeft: 20, marginBottom: 8 }}>{children}</ul>
          ),
          ol: ({ children }: { children: React.ReactNode }) => (
            <ol style={{ paddingLeft: 20, marginBottom: 8 }}>{children}</ol>
          ),
          li: ({ children }: { children: React.ReactNode }) => (
            <li style={{ marginBottom: 3, color: theme.colors.textPrimary }}>{children}</li>
          ),
          a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
            <a href={href} style={{ color: theme.colors.accent, textDecoration: 'underline' }}
               target="_blank" rel="noopener noreferrer">{children}</a>
          ),
          strong: ({ children }: { children: React.ReactNode }) => (
            <strong style={{ fontWeight: 700, color: theme.colors.textPrimary }}>{children}</strong>
          ),
          em: ({ children }: { children: React.ReactNode }) => (
            <em style={{ fontStyle: 'italic', color: theme.colors.textPrimary }}>{children}</em>
          ),
          hr: () => (
            <hr style={{ border: 'none', borderTop: `1px solid ${theme.colors.borderDefault}`, margin: '12px 0' }} />
          ),
          // Render checkboxes for GFM task lists
          input: ({ type, checked }: { type?: string; checked?: boolean }) =>
            type === 'checkbox' ? (
              <input type="checkbox" checked={checked} readOnly
                style={{ marginRight: 6, accentColor: theme.colors.accent }} />
            ) : null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Native renderer — custom inline parser
// ---------------------------------------------------------------------------

type ParsedSegment =
  | { kind: 'text';        text: string }
  | { kind: 'bold';        text: string }
  | { kind: 'italic';      text: string }
  | { kind: 'code';        text: string }
  | { kind: 'strike';      text: string }
  | { kind: 'link';        text: string; url: string }
  | { kind: 'hashtag';     text: string };

/**
 * Parses a single inline markdown string into typed segments.
 * Supports: **bold**, *italic*, `code`, ~~strikethrough~~, [text](url), #tag
 */
function parseInline(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  // Regex alternation: process patterns in priority order
  const pattern =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|~~(.+?)~~|\[(.+?)\]\((.+?)\)|(#[\w-]+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Capture literal text before this match
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', text: text.slice(lastIndex, match.index) });
    }

    if (match[1]) segments.push({ kind: 'bold',    text: match[2] ?? '' });
    else if (match[3]) segments.push({ kind: 'italic',  text: match[4] ?? '' });
    else if (match[5]) segments.push({ kind: 'code',    text: match[6] ?? '' });
    else if (match[7]) segments.push({ kind: 'strike',  text: match[7] });
    else if (match[8]) segments.push({ kind: 'link',    text: match[8], url: match[9] ?? '' });
    else if (match[10]) segments.push({ kind: 'hashtag', text: match[10] });

    lastIndex = pattern.lastIndex;
  }

  // Remaining literal text
  if (lastIndex < text.length) {
    segments.push({ kind: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}

type BlockNode =
  | { type: 'heading';    level: 1 | 2 | 3; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'bullet';     text: string }
  | { type: 'hr' }
  | { type: 'codeblock';  code: string; lang: string }
  | { type: 'paragraph';  text: string };

/** Splits markdown into block-level nodes */
function parseBlocks(markdown: string): BlockNode[] {
  const lines  = markdown.split('\n');
  const blocks: BlockNode[] = [];
  let   inCode = false;
  let   codeBuf: string[] = [];
  let   codeLang = '';

  for (const raw of lines) {
    const line = raw;

    // Fenced code block
    if (line.startsWith('```')) {
      if (!inCode) {
        inCode   = true;
        codeLang = line.slice(3).trim();
        codeBuf  = [];
      } else {
        blocks.push({ type: 'codeblock', code: codeBuf.join('\n'), lang: codeLang });
        inCode  = false;
        codeBuf = [];
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    // Headings
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) { blocks.push({ type: 'heading', level: 3, text: h3[1] ?? '' }); continue; }
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) { blocks.push({ type: 'heading', level: 2, text: h2[1] ?? '' }); continue; }
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) { blocks.push({ type: 'heading', level: 1, text: h1[1] ?? '' }); continue; }

    // Blockquote
    const bq = line.match(/^>\s?(.*)/);
    if (bq) { blocks.push({ type: 'blockquote', text: bq[1] ?? '' }); continue; }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: 'hr' }); continue;
    }

    // Bullet list items
    const bullet = line.match(/^[-*+]\s+(.*)/);
    if (bullet) { blocks.push({ type: 'bullet', text: bullet[1] ?? '' }); continue; }

    // Paragraph (blank lines create spacing)
    blocks.push({ type: 'paragraph', text: line });
  }

  return blocks;
}

function NativeMarkdownRenderer({ content, maxLines }: { content: string; maxLines?: number }) {
  const theme  = useTheme();
  const blocks = parseBlocks(content);

  function renderInlineSegments(text: string, baseStyle?: object) {
    const segs = parseInline(text);
    return segs.map((seg, i) => {
      switch (seg.kind) {
        case 'bold':
          return <Text key={i} style={[baseStyle, { fontWeight: '700' }]}>{seg.text}</Text>;
        case 'italic':
          return <Text key={i} style={[baseStyle, { fontStyle: 'italic' }]}>{seg.text}</Text>;
        case 'code':
          return (
            <Text key={i} style={[baseStyle, nStyles.inlineCode, {
              backgroundColor: theme.colors.bgTertiary,
              color: theme.colors.accent,
            }]}>
              {seg.text}
            </Text>
          );
        case 'strike':
          return <Text key={i} style={[baseStyle, { textDecorationLine: 'line-through' }]}>{seg.text}</Text>;
        case 'link':
          return <Text key={i} style={[baseStyle, { color: theme.colors.accent, textDecorationLine: 'underline' }]}>{seg.text}</Text>;
        case 'hashtag':
          return <Text key={i} style={[baseStyle, { color: theme.colors.accent, fontWeight: '500' }]}>{seg.text}</Text>;
        default:
          return <Text key={i} style={baseStyle}>{seg.text}</Text>;
      }
    });
  }

  const baseTextStyle = { color: theme.colors.textPrimary, fontSize: 14, lineHeight: 22 };

  return (
    <View>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading': {
            const sizes = { 1: 20, 2: 17, 3: 15 } as const;
            const weights = { 1: '700', 2: '600', 3: '600' } as const;
            return (
              <Text key={idx} style={[nStyles.heading, {
                fontSize: sizes[block.level],
                fontWeight: weights[block.level],
                color: theme.colors.textPrimary,
              }]} numberOfLines={maxLines}>
                {renderInlineSegments(block.text)}
              </Text>
            );
          }
          case 'blockquote':
            return (
              <View key={idx} style={[nStyles.blockquote, { borderLeftColor: theme.colors.accent }]}>
                <Text style={[baseTextStyle, { fontStyle: 'italic', color: theme.colors.textSecondary }]}
                  numberOfLines={maxLines}>
                  {renderInlineSegments(block.text)}
                </Text>
              </View>
            );
          case 'bullet':
            return (
              <View key={idx} style={nStyles.bulletRow}>
                <Text style={[baseTextStyle, nStyles.bulletDot, { color: theme.colors.textSecondary }]}>•</Text>
                <Text style={[baseTextStyle, { flex: 1 }]} numberOfLines={maxLines}>
                  {renderInlineSegments(block.text)}
                </Text>
              </View>
            );
          case 'hr':
            return <View key={idx} style={[nStyles.hr, { borderTopColor: theme.colors.borderDefault }]} />;
          case 'codeblock':
            return (
              <View key={idx} style={[nStyles.codeBlock, { backgroundColor: theme.colors.bgTertiary }]}>
                <Text style={[nStyles.codeBlockText, { color: theme.colors.textPrimary }]}
                  numberOfLines={maxLines}>
                  {block.code}
                </Text>
              </View>
            );
          case 'paragraph':
            if (!block.text.trim()) return <View key={idx} style={nStyles.emptyLine} />;
            return (
              <Text key={idx} style={baseTextStyle} numberOfLines={maxLines}>
                {renderInlineSegments(block.text)}
              </Text>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Public component — routes to platform-appropriate renderer
// ---------------------------------------------------------------------------

export function MarkdownRenderer({
  content,
  maxLines,
  scrollable = false,
}: MarkdownRendererProps) {
  if (!content.trim()) return null;

  const renderer = Platform.OS === 'web'
    ? <WebMarkdownRenderer content={content} />
    : <NativeMarkdownRenderer content={content} maxLines={maxLines} />;

  if (scrollable) {
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {renderer}
      </ScrollView>
    );
  }

  return renderer;
}

// ---------------------------------------------------------------------------
// Native styles
// ---------------------------------------------------------------------------

const nStyles = StyleSheet.create({
  heading:      { marginTop: 12, marginBottom: 4 },
  blockquote:   { borderLeftWidth: 3, paddingLeft: 12, marginVertical: 6 },
  bulletRow:    { flexDirection: 'row', gap: 8, marginVertical: 2 },
  bulletDot:    { width: 12, marginTop: 2 },
  hr:           { borderTopWidth: 1, marginVertical: 12 },
  codeBlock:    { borderRadius: 8, padding: 12, marginVertical: 6 },
  codeBlockText:{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 12, lineHeight: 18 },
  inlineCode:   { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', borderRadius: 3, paddingHorizontal: 4 },
  emptyLine:    { height: 8 },
});
