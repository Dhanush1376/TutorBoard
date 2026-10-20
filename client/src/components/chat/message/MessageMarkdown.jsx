import React from 'react';
import CodeBlock from './CodeBlock';

/**
 * Markdown renderers for assistant answers.
 *
 * Reading comfort first: one body size (15px / 1.7), quiet headings, tables and
 * display math that scroll inside the answer instead of widening the chat, and
 * long URLs that wrap. Colours come from the theme tokens so light and dark both work.
 *
 * react-markdown v10 no longer tells the `code` renderer whether it is inline,
 * so fenced blocks are taken from `pre` (always a block) and `code` alone is inline.
 */

const text = 'var(--text-primary)';
const muted = 'var(--text-secondary)';
const line = 'var(--st-line-strong, var(--border-color))';
const fill = 'var(--st-fill, var(--bg-secondary))';

const safeHref = (href) => {
  try {
    const parsed = new URL(href, window.location.origin);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return parsed.toString();
  } catch { /* not a URL */ }
  return null;
};

export const buildMarkdownComponents = (onOpenArtifact) => ({
  p: ({ children }) => (
    <p style={{ margin: '0 0 0.85em', lineHeight: 1.7, fontSize: 15, color: text, overflowWrap: 'anywhere' }}>
      {children}
    </p>
  ),
  strong: ({ children }) => <strong style={{ fontWeight: 600, color: text }}>{children}</strong>,
  em: ({ children }) => <em style={{ fontStyle: 'italic', color: text }}>{children}</em>,
  h1: ({ children }) => (
    <h1 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.35, margin: '1.4em 0 0.5em', color: text }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.4, margin: '1.3em 0 0.45em', color: text }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.45, margin: '1.2em 0 0.4em', color: text }}>
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5, margin: '1.1em 0 0.35em', color: text }}>
      {children}
    </h4>
  ),
  ul: ({ children }) => <ul style={{ paddingLeft: '1.3em', margin: '0 0 0.85em', listStyleType: 'disc' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: '1.45em', margin: '0 0 0.85em', listStyleType: 'decimal' }}>{children}</ol>,
  li: ({ children }) => (
    <li style={{ margin: '0 0 0.3em', paddingLeft: '0.2em', lineHeight: 1.7, fontSize: 15, color: text }}>
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{ borderLeft: `2px solid ${line}`, margin: '0 0 0.85em', padding: '0.1em 0 0.1em 1em', color: muted, fontStyle: 'normal' }}>
      {children}
    </blockquote>
  ),
  // Fenced code: the single <code> child carries the language class and the text.
  pre: ({ children }) => {
    const child = React.Children.toArray(children)[0];
    const props = React.isValidElement(child) ? child.props : {};
    return (
      <CodeBlock className={props.className} onOpenArtifact={onOpenArtifact}>
        {props.children ?? ''}
      </CodeBlock>
    );
  },
  // Only inline code reaches here (blocks are handled by `pre`).
  code: ({ children }) => (
    <code style={{
      fontFamily: 'var(--font-mono)', fontSize: '0.86em', fontWeight: 500,
      background: 'var(--st-fill-strong, var(--bg-tertiary))', borderRadius: 5,
      padding: '0.12em 0.38em', color: text, overflowWrap: 'anywhere', border: 'none',
    }}>
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div
      role="region"
      aria-label="Table"
      tabIndex={0}
      style={{ overflowX: 'auto', margin: '0.25em 0 1em', borderRadius: 10, border: `1px solid ${line}`, maxWidth: '100%' }}
    >
      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: 14, fontVariantNumeric: 'tabular-nums', margin: 0, border: 'none' }}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, style }) => (
    <th style={{
      textAlign: style?.textAlign || 'left', padding: '8px 12px', background: fill,
      borderBottom: `1px solid ${line}`, fontWeight: 600, fontSize: 13, color: text, whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={{
      textAlign: style?.textAlign || 'left', padding: '8px 12px', borderBottom: `1px solid ${line}`,
      // columns take their natural width (the wrapper scrolls); only long prose wraps
      color: text, verticalAlign: 'top', maxWidth: 280,
    }}>
      {children}
    </td>
  ),
  a: ({ children, href }) => {
    const url = safeHref(href);
    if (!url) return <span>{children}</span>;
    const isMailto = url.startsWith('mailto:');
    return (
      <a
        href={url}
        target={isMailto ? undefined : '_blank'}
        rel={isMailto ? undefined : 'noopener noreferrer'}
        style={{
          color: text, textDecoration: 'underline', textUnderlineOffset: 3,
          textDecorationColor: 'var(--mk-accent, currentColor)', textDecorationThickness: 1,
          overflowWrap: 'anywhere',
        }}
      >
        {children}
      </a>
    );
  },
  hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${line}`, margin: '1.4em 0' }} />,
});
