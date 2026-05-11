import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';

const SourceGrid = ({ sources, searchPerformed }) => {
  if (!searchPerformed && (!sources || sources.length === 0)) return null;

  return (
    <div className="mb-4 w-full">
      <motion.div
        initial={{ opacity: 0, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-2 w-fit px-0"
      >
        {sources?.length > 0 ? (
          <div className="flex items-center gap-2">
            <BookOpen size={13} style={{ color: 'var(--text-tertiary)', opacity: 0.6 }} />
            <span style={{
              fontSize: 11.5,
              fontWeight: 500,
              color: 'var(--text-tertiary)',
              letterSpacing: '-0.01em',
              opacity: 0.8
            }}>
              Searched the web · {sources.length} sources
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-[4px] opacity-40">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.3, 1, 0.3]
                  }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: 'easeInOut',
                  }}
                  style={{
                    width: 3.5,
                    height: 3.5,
                    borderRadius: '50%',
                    background: 'var(--text-tertiary)',
                  }}
                />
              ))}
            </div>
            <span style={{
              fontSize: 11.5,
              fontWeight: 500,
              color: 'var(--text-tertiary)',
              letterSpacing: '-0.01em',
              opacity: 0.8
            }}>
              Searching the web...
            </span>
          </div>
        )}
      </motion.div>

      {sources?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {sources.map((source, idx) => {
            let hostname = 'Link';
            let favicon = '';
            try {
              const url = new URL(source.url);
              hostname = url.hostname.replace('www.', '');
              favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
            } catch { }
            return (
              <a
                key={idx}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 rounded-xl border transition-all"
                style={{
                  width: 138,
                  padding: '10px 10px',
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  textDecoration: 'none',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1.5 overflow-hidden">
                  {favicon && <img src={favicon} alt="" style={{ width: 12, height: 12, borderRadius: 2, opacity: 0.7 }} onError={e => { e.target.style.display = 'none'; }} />}
                  <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hostname}</span>
                  {source.isMock && (
                    <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', padding: '1px 4px', borderRadius: 4, marginLeft: 'auto' }}>SIMULATED</span>
                  )}
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {source.title}
                </p>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SourceGrid;
