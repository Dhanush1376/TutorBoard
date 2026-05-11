import React from 'react';
import CodeBlock from './CodeBlock';

export const buildMarkdownComponents = (onOpenArtifact) => ({
  p: ({ children }) => (
    <p style={{ marginBottom: 12, lineHeight: 1.7, fontSize: 14.5, color: 'var(--text-primary)', opacity: 0.95, wordBreak: 'break-word' }}>
      {children}
    </p>
  ),
  strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{children}</strong>,
  em: ({ children }) => <em style={{ fontStyle: 'italic', opacity: 0.85 }}>{children}</em>,
  h1: ({ children }) => (
    <h1 style={{ 
      fontSize: 20, fontWeight: 800, marginBottom: 16, marginTop: 28, 
      letterSpacing: '-0.02em', color: 'var(--text-primary)', 
      borderBottom: '2px solid var(--border-color)', paddingBottom: 12 
    }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ 
      fontSize: 18, fontWeight: 700, marginBottom: 14, marginTop: 24, 
      letterSpacing: '-0.01em', color: 'var(--text-primary)' 
    }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ 
      fontSize: 16, fontWeight: 700, marginBottom: 12, marginTop: 20, 
      color: 'var(--text-primary)', letterSpacing: '-0.01em' 
    }}>
      {children}
    </h3>
  ),
  ul: ({ children }) => <ul style={{ paddingLeft: 24, marginBottom: 12, listStyleType: 'disc' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: 24, marginBottom: 12, listStyleType: 'decimal' }}>{children}</ol>,
  li: ({ children }) => (
    <li style={{ marginBottom: 8, lineHeight: 1.8, fontSize: 14.5, color: 'var(--text-primary)', opacity: 0.9 }}>
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{ 
      borderLeft: '4px solid var(--text-tertiary)', 
      paddingLeft: 20, marginLeft: 0, marginTop: 18, marginBottom: 18, 
      opacity: 0.95, fontStyle: 'italic', 
      background: 'rgba(var(--bg-secondary-rgb), 0.5)',
      paddingTop: 8, paddingBottom: 8, borderRadius: '0 8px 8px 0'
    }}>
      {children}
    </blockquote>
  ),
  code: ({ className, children, inline }) => {
    if (inline) {
      return (
        <code style={{
          fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600,
          background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
          borderRadius: 6, padding: '1px 5px', color: 'var(--text-primary)',
        }}>
          {children}
        </code>
      );
    }
    return <CodeBlock className={className} onOpenArtifact={onOpenArtifact}>{children}</CodeBlock>;
  },
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', marginBottom: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{ 
      textAlign: 'left', 
      padding: '12px 14px', 
      background: 'var(--bg-secondary)', 
      borderBottom: '2px solid var(--border-color)', 
      fontWeight: 700, 
      fontSize: 11, 
      color: 'var(--text-primary)', 
      textTransform: 'uppercase', 
      letterSpacing: '0.08em',
      whiteSpace: 'nowrap'
    }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ 
      padding: '12px 14px', 
      borderBottom: '1px solid var(--border-color)', 
      color: 'var(--text-primary)', 
      opacity: 0.9,
      minWidth: '120px'
    }}>
      {children}
    </td>
  ),
  a: ({ children, href }) => {
    let safeHref = '#';
    try {
      const parsed = new URL(href, window.location.origin);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
        safeHref = parsed.toString();
      }
    } catch {
      safeHref = '#';
    }
    return (
      <a href={safeHref} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: 'var(--info)', opacity: 0.9 }}>{children}</a>
    );
  },
  hr: () => <hr style={{ border: 'none', borderTop: '2px solid var(--border-color)', margin: '20px 0' }} />,
});
