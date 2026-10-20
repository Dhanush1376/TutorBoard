import React from 'react';
import { fonts } from '../../theme';
import { Icon, IconAt } from './Icons';

/**
 * A faithful, resolution-independent rebuild of TutorBoard's lesson screen
 * (sidebar + composer, header pill, canvas, step pills, control bar, Session
 * panel), laid out in the app's own 1920×1080 CSS px. Every position and
 * colour was measured from 4K captures of the running app, so it cuts
 * seamlessly against the real footage — and stays sharp at macro zoom.
 */

export const UI = {
  bg: '#080705',
  card: '#101010',
  cardBorder: '#262626',
  panelBorder: '#232323',
  cream: '#F4F3EE',
  ink: '#F4F4F4',
  text: '#CFCFCF',
  dim: '#8C8C8C',
  faint: '#5B5A57',
  indigo: '#6366F1',
  violet: '#7B7BF5',
  green: '#34D399',
  amber: '#F59E0B',
  orange: '#F97316',
  teal: '#2DB89C',
  red: '#E5484D',
};

/** Canvas area centre (the pills and control bar centre on it). */
export const CANVAS_CX = 975.5;

export type StepStatus = 'done' | 'active' | 'todo';

export type LessonState = {
  title: string;
  kind: string;
  guide: string;
  steps: string[];
  /** 0-based active step */
  active: number;
  explanation: string;
  /** 0..1 cross-fade of the explanation text (for step changes) */
  explanationIn?: number;
  /** typewriter: characters of the explanation shown (the app types it in) */
  explanationChars?: number;
  core?: string;
  playing: boolean;
  progress: number;
  time: [string, string];
  muted?: boolean;
  /** 0..1 — the doubt input expanding in the control bar */
  doubtOpen?: number;
  doubtText?: string;
  caret?: boolean;
  /** Session panel "Your question" card */
  question?: { q: string; step: number; answer: string; answerChars: number; answerIn?: number; followUp?: string; followIn?: number; looking?: number; in: number };
  chatQuestion: string;
  /** 0..1 of the assistant's reply in the sidebar */
  replyIn?: number;
  composerText?: string;
  composerCaret?: boolean;
  /** highlight a control (hover state) */
  hover?: 'play' | 'doubt' | 'resume' | 'send' | null;
  panelIn?: number;
  chromeIn?: number;
};

const label: React.CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: '0.2em',
  color: 'rgba(244,244,244,0.5)',
  textTransform: 'uppercase',
};

const abs = (x: number, y: number, extra?: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', left: x, top: y, ...extra });

// ─────────────────────────────────────────────────────────────────────────────
// Canvas texture: 40 px grid + scattered star dots (measured from the app)
export const CanvasTexture: React.FC<{ x?: number; y?: number; w?: number; h?: number }> = ({ x = 352, y = 0, w = 1568, h = 1080 }) => {
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const dots = React.useMemo(() => {
    const out: Array<[number, number, number]> = [];
    let s = 7;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 170; i++) out.push([r() * 200, r() * 200, 0.035 + r() * 0.06]);
    return out;
  }, []);
  return (
    <svg style={abs(x, y)} width={w} height={h}>
      <defs>
        <pattern id={`g${id}`} width={40} height={40} patternUnits="userSpaceOnUse" x={0} y={0}>
          <path d="M 0 0 L 40 0 M 0 0 L 0 40" stroke="rgba(255,255,255,0.028)" strokeWidth={1} fill="none" />
        </pattern>
        <pattern id={`d${id}`} width={200} height={200} patternUnits="userSpaceOnUse">
          {dots.map(([dx, dy, a], i) => (
            <rect key={i} x={dx} y={dy} width={1.3} height={1.3} fill={`rgba(255,255,255,${a})`} />
          ))}
        </pattern>
      </defs>
      <rect width={w} height={h} fill={`url(#g${id})`} />
      <rect width={w} height={h} fill={`url(#d${id})`} />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export const CubeMark: React.FC<{ size: number; color?: string }> = ({ size, color = '#E9E7E1' }) => (
  <svg width={size} height={size * 1.3} viewBox="240 60 200 260" style={{ display: 'block' }}>
    <polygon points="340,90 427,140 340,190 253,140" fill={color} fillOpacity="0.1" />
    <polygon points="253,140 340,190 340,290 253,240" fill={color} fillOpacity="0.3" />
    <polygon points="340,190 427,140 427,240 340,290" fill={color} fillOpacity="0.5" />
    <polygon points="340,158 376,179 340,200 304,179" fill={color} fillOpacity="0.2" />
    <polygon points="304,179 340,200 340,242 304,221" fill={color} fillOpacity="0.4" />
    <polygon points="340,200 376,179 376,221 340,242" fill={color} fillOpacity="0.8" />
  </svg>
);

const Caret: React.FC<{ on?: boolean; h?: number; color?: string }> = ({ on, h = 18, color = UI.cream }) => (
  <span style={{ display: 'inline-block', width: 1.5, height: h, background: color, marginLeft: 1, verticalAlign: 'middle', opacity: on ? 1 : 0 }} />
);

// ─────────────────────────────────────────────────────────────────────────────
export const Sidebar: React.FC<{ s: LessonState }> = ({ s }) => {
  const reply = s.replyIn ?? 1;
  return (
    <div style={abs(0, 0, { width: 351, height: 1080, fontFamily: fonts.sans })}>
      <div style={abs(21, 25)}><CubeMark size={22} /></div>
      <div style={abs(52, 28, { fontSize: 13, fontWeight: 500, letterSpacing: '0.2em', color: '#E9E7E1', lineHeight: '18px' })}>TUTORBOARD</div>
      <IconAt x={272} y={38} name="settings" size={20} color="#EDEDED" stroke={1.8} />
      <IconAt x={312} y={38} name="panelLeft" size={20} color="#EDEDED" stroke={1.8} />
      <IconAt x={34} y={96} name="chevronLeft" size={12} color="#BDBBB5" stroke={2.4} />
      <div style={abs(48, 89, { fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: '#C9C7C1', lineHeight: '14px' })}>ALL SESSIONS</div>
      <IconAt x={286} y={96} name="fileText" size={16} color="#DDDDDD" stroke={1.8} />
      <IconAt x={321} y={96} name="download" size={16} color="#DDDDDD" stroke={1.8} />
      <div style={abs(12, 121, { width: 332, height: 1, background: 'rgba(255,255,255,0.05)' })} />

      {/* conversation */}
      <div style={abs(16, 144, { width: 322, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' })}>
        <div
          style={{
            maxWidth: 262,
            background: UI.cream,
            color: '#151515',
            borderRadius: '22px 22px 6px 22px',
            padding: '15px 21px 15px 21px',
            fontSize: 13.8,
            fontWeight: 500,
            lineHeight: '23px',
          }}
        >
          {s.chatQuestion}
        </div>
        <div style={{ display: 'flex', gap: 15, marginTop: 7, marginRight: 7 }}>
          <Icon name="undo" size={14} color={UI.faint} />
          <Icon name="pencil" size={14} color={UI.faint} />
          <Icon name="copy" size={14} color={UI.faint} />
        </div>
        <div
          style={{
            alignSelf: 'flex-start',
            marginTop: 12,
            fontSize: 14.5,
            fontWeight: 400,
            lineHeight: '24.5px',
            color: '#E9E7E1',
            opacity: reply,
            transform: `translateY(${(1 - reply) * 8}px)`,
          }}
        >
          I've prepared a visual learning canvas for you on <b style={{ fontWeight: 700, color: '#FFFFFF' }}>{s.chatQuestion}</b>. Dive in whenever you're ready!
          <div style={{ display: 'flex', gap: 15, marginTop: 14, marginLeft: 7 }}>
            <Icon name="refresh" size={14} color={UI.faint} />
            <Icon name="copy" size={14} color={UI.faint} />
          </div>
        </div>
      </div>

      <Composer text={s.composerText} caret={s.composerCaret} hoverSend={s.hover === 'send'} />
    </div>
  );
};

export const Composer: React.FC<{ text?: string; caret?: boolean; hoverSend?: boolean; chip?: boolean }> = ({ text, caret, hoverSend, chip = true }) => {
  const typed = !!text;
  return (
    <div style={abs(16, 883, { width: 317, height: 180, borderRadius: 30, background: '#0A0A0A', border: '1px solid #1C1C1C', boxSizing: 'border-box', fontFamily: fonts.sans })}>
      {chip && (
        <div style={abs(20, 20, { height: 23, borderRadius: 12, background: UI.cream, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 0 9px' })}>
          <Icon name="layers" size={12} color="#111" stroke={2.2} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.03em', color: '#111' }}>DEEP VISUAL DIVE</span>
          <Icon name="x" size={11} color="#111" stroke={2.4} style={{ marginLeft: 3 }} />
        </div>
      )}
      <div style={abs(28, 63, { width: 262, fontSize: typed ? 14.5 : 15.5, lineHeight: '22px', color: typed ? '#ECEAE4' : '#6E6D69' })}>
        {typed ? (<>{text}<Caret on={caret} h={18} /></>) : (<>{caret ? <Caret on h={18} /> : null}Ask anything...</>)}
      </div>
      <IconAt x={37} y={143} name="plus" size={20} color="#E8E8E8" stroke={1.9} />
      <IconAt x={80} y={143} name="sliders" size={18} color="#E8E8E8" stroke={1.9} />
      <IconAt x={110} y={143} name="bot" size={16} color="#8A8986" stroke={1.9} />
      <div style={abs(127, 137, { fontSize: 9.4, fontWeight: 700, letterSpacing: '0.08em', color: '#8A8986', lineHeight: '12px' })}>TUTORBOARD</div>
      <IconAt x={210} y={143} name="chevronDown" size={10} color="#6A6A6A" />
      <IconAt x={233} y={143} name="mic" size={18} color="#E8E8E8" stroke={1.9} />
      <div
        style={abs(257, 121, {
          width: 44, height: 44, borderRadius: 22,
          background: typed ? UI.cream : 'rgba(255,255,255,0.03)',
          boxShadow: hoverSend ? '0 0 0 4px rgba(244,243,238,0.12)' : undefined,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        })}
      >
        <Icon name="arrowUp" size={20} color={typed ? '#111' : UI.cream} stroke={2.2} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export const HeaderPill: React.FC<{ s: LessonState }> = ({ s }) => (
  <>
    <div
      style={abs(367, 16, {
        height: 53, borderRadius: 27, background: UI.card, border: `1px solid ${UI.cardBorder}`, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', fontFamily: fonts.sans, paddingRight: 22,
      })}
    >
      <div style={{ width: 68, display: 'flex', justifyContent: 'center' }}><Icon name="menu" size={18} color="#D8D8D8" stroke={1.8} /></div>
      <div style={{ width: 1, height: 26, background: '#2A2A2A' }} />
      <div style={{ marginLeft: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 12.7, fontWeight: 700, color: UI.ink, letterSpacing: '-0.01em', lineHeight: '16px', whiteSpace: 'nowrap' }}>{s.title}</div>
        <div style={{ fontSize: 9.2, fontWeight: 500, letterSpacing: '0.1em', color: '#6E6E6E', lineHeight: '11px' }}>{s.kind}</div>
      </div>
      <div style={{ width: 1, height: 26, background: '#2A2A2A', marginLeft: 11 }} />
      <div style={{ marginLeft: 18, fontSize: 12, fontWeight: 600, color: '#8A8A8A' }}>{`${s.active + 1}/${s.steps.length}`}</div>
      <Icon name="minimize" size={15} color="#E5E5E5" style={{ marginLeft: 18 }} />
      <Icon name="x" size={15} color={UI.red} stroke={2.2} style={{ marginLeft: 19 }} />
    </div>
    <div
      style={abs(377, 82, {
        height: 26, borderRadius: 13, background: '#0D0D0B', border: `1px solid ${UI.cardBorder}`, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px 0 11px', fontFamily: fonts.sans,
      })}
    >
      <div style={{ width: 6, height: 6, borderRadius: 3, background: '#8A8A8A' }} />
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', color: '#BDBDBD' }}>{s.core ?? `CORE · ${s.active + 1}`}</span>
    </div>
  </>
);

export const Toolbar: React.FC = () => {
  const xs = [1572, 1615, 1657, 1699, 1741, 1784, 1826];
  const names = ['type', 'pencil', 'file', 'square', 'code', 'share', 'trash'] as const;
  return (
    <>
      <div style={abs(1544, 21, { width: 355, height: 54, borderRadius: 27, background: UI.card, border: `1px solid ${UI.cardBorder}`, boxSizing: 'border-box' })} />
      {xs.map((x, i) => (
        <React.Fragment key={x}>
          <IconAt x={x} y={48} name={names[i]} size={19} color="#A8A8A8" stroke={1.7} />
          {i < 4 && <div style={abs(x + 10, 59, { width: 3.2, height: 3.2, borderRadius: 2, background: '#8A8A8A' })} />}
        </React.Fragment>
      ))}
      <div style={abs(1851, 28, { width: 40, height: 40, borderRadius: 16, border: '1px solid #2C2C2C', background: '#141414', boxSizing: 'border-box' })} />
      <IconAt x={1871} y={48} name="user" size={18} color="#C8C8C8" stroke={1.8} />
    </>
  );
};

export const CanvasRail: React.FC = () => (
  <>
    <div style={abs(376, 883, { width: 44, height: 163, borderRadius: 22, background: '#0D0D0D', border: '1px solid #222', boxSizing: 'border-box' })} />
    <IconAt x={398} y={905} name="undo" size={14} color="#C8C8C8" />
    <IconAt x={398} y={946} name="redo" size={14} color="#C8C8C8" />
    <IconAt x={398} y={985} name="locate" size={14} color="#C8C8C8" />
    <IconAt x={398} y={1025} name="bookmark" size={14} color="#C8C8C8" />
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
export const stepStatus = (i: number, active: number): StepStatus => (i < active ? 'done' : i === active ? 'active' : 'todo');

export const StepPills: React.FC<{ n: number; active: number; pulse?: number }> = ({ n, active, pulse = 0 }) => {
  const gap = 51.7;
  const x0 = CANVAS_CX - ((n - 1) * gap) / 2;
  return (
    <>
      {Array.from({ length: n - 1 }, (_, i) => (
        <div key={`c${i}`} style={abs(x0 + i * gap + 19, 947.5, { width: gap - 38, height: 1.2, background: i < active ? '#4A4A4A' : '#1E1E1E' })} />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const st = stepStatus(i, active);
        const cx = x0 + i * gap;
        const style: React.CSSProperties =
          st === 'active'
            ? { background: UI.cream, color: '#111', fontWeight: 700, boxShadow: pulse > 0 ? `0 0 0 ${pulse * 6}px rgba(244,243,238,${0.18 * (1 - pulse)})` : undefined }
            : st === 'done'
              ? { background: '#0F2E1D', border: '1px solid #1D5C3A' }
              : { background: '#1A1917', border: '1px solid #343330', color: '#A3A3A3', fontWeight: 600 };
        return (
          <div
            key={i}
            style={abs(cx - 16, 932, {
              width: 32, height: 32, borderRadius: 11, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: fonts.sans, fontSize: 12, ...style,
            })}
          >
            {st === 'done' ? <Icon name="check" size={14} color={UI.green} stroke={2.6} /> : i + 1}
          </div>
        );
      })}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export const ControlBar: React.FC<{ s: LessonState }> = ({ s }) => {
  const o = s.doubtOpen ?? 0;
  const dx = -97 * o;
  const left = 741 + dx;
  const right = 1210 + 97 * o;
  const px = 876 + dx;
  const pw = 129;
  const thumb = px + pw * s.progress;
  const step = `${s.active + 1}`;
  const divider = (x: number) => <div style={abs(x, 1003, { width: 1, height: 30, background: UI.cardBorder })} />;
  return (
    <div style={{ fontFamily: fonts.sans }}>
      <div style={abs(left, 989, { width: right - left, height: 57, borderRadius: 29, background: UI.card, border: `1px solid ${UI.cardBorder}`, boxSizing: 'border-box', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' })} />
      <IconAt x={774 + dx} y={1018} name="skipBack" size={14} color="#4A4A4A" fill="#4A4A4A" />
      {s.playing && <div style={abs(807 + dx - 24, 994, { width: 48, height: 48, borderRadius: 24, border: '1.5px solid rgba(255,255,255,0.13)', boxSizing: 'border-box' })} />}
      <div
        style={abs(807 + dx - 19, 999, {
          width: 38, height: 38, borderRadius: 19, background: UI.cream, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: s.hover === 'play' ? '0 0 0 5px rgba(244,243,238,0.14)' : '0 4px 14px rgba(0,0,0,0.4)',
        })}
      >
        {s.playing ? (
          <svg width={14} height={14} viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.4" fill="#111" /><rect x="14" y="4" width="5" height="16" rx="1.4" fill="#111" /></svg>
        ) : (
          <svg width={15} height={15} viewBox="0 0 24 24" style={{ marginLeft: 2 }}><path d="M6 3.5 20 12 6 20.5Z" fill="#111" stroke="#111" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        )}
      </div>
      <IconAt x={839 + dx} y={1018} name="skipForward" size={14} color="#E5E5E5" fill="#E5E5E5" />
      {divider(864 + dx)}
      <div style={abs(px, 1006.5, { width: pw, height: 3, borderRadius: 2, background: '#2A2A2A' })} />
      <div style={abs(px, 1006.5, { width: Math.max(0, thumb - px), height: 3, borderRadius: 2, background: UI.cream })} />
      <div style={abs(thumb - 7, 1001, { width: 14, height: 14, borderRadius: 7, background: UI.cream, display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
        <div style={{ width: 10, height: 10, borderRadius: 5, border: '2px solid #101010', boxSizing: 'border-box', background: UI.cream }} />
      </div>
      <div style={abs(878 + dx, 1020, { fontSize: 9.3, fontWeight: 700, letterSpacing: '0.06em', color: '#9A9A9A', lineHeight: '12px', whiteSpace: 'nowrap' })}>
        STEP {step} <span style={{ color: '#5A5A5A' }}>/</span> {s.steps.length}
      </div>
      <div style={abs(950 + dx, 1020, { fontSize: 10.5, fontWeight: 600, color: '#9A9A9A', lineHeight: '12px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' })}>
        {s.time[0]} <span style={{ color: '#5A5A5A' }}>/</span> {s.time[1]}
      </div>
      {divider(1018 + dx)}
      <IconAt x={1046 + dx} y={1018} name="gauge" size={14} color="#BDBDBD" />
      <div style={abs(1056 + dx, 1011, { fontSize: 12, fontWeight: 700, color: '#BDBDBD', lineHeight: '14px' })}>1x</div>
      <IconAt x={1076 + dx} y={1018} name="chevronUp" size={9} color="#777" stroke={2.4} />
      {divider(1102 + dx)}
      <IconAt x={1127 + dx} y={1018} name={s.muted ? 'volumeX' : 'volume'} size={16} color="#CFCFCF" stroke={1.8} />
      {divider(1152 + dx * 0.5)}
      <IconAt x={1177} y={1018} name="message" size={16} color={s.hover === 'doubt' ? '#FFFFFF' : '#CFCFCF'} stroke={1.8} opacity={1 - Math.min(1, o * 2)} />
      {o > 0.01 && (
        <div
          style={abs(1067, 1000, {
            width: 220 * o, height: 36, borderRadius: 18, border: '1px solid rgba(255,255,255,0.2)', background: '#0B0B0B', boxSizing: 'border-box',
            overflow: 'hidden', opacity: Math.min(1, o * 1.6), display: 'flex', alignItems: 'center',
          })}
        >
          <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left', paddingLeft: 12, paddingRight: 4 }}>
            <span style={{ direction: 'ltr', unicodeBidi: 'bidi-override', fontSize: 14, fontWeight: 500, color: s.doubtText ? '#F4F4F4' : '#77756F' }}>
              {s.doubtText || 'Ask about this step…'}
            </span>
          </div>
          <Caret on={s.caret} h={17} />
          <div style={{ width: 26, height: 26, borderRadius: 13, background: s.doubtText ? UI.cream : '#2A2A2A', margin: '0 5px 0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="send" size={12} color={s.doubtText ? '#111' : '#888'} stroke={2.2} />
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const Section: React.FC<{ icon: 'message' | 'bulb' | 'list'; color: string; text: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ icon, color, text, children, style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 14, opacity: 0.5, paddingLeft: 1 }}>
      <Icon name={icon} size={12} color={color} stroke={2} />
      <span style={{ ...label, color: UI.ink, lineHeight: '12px' }}>{text}</span>
    </div>
    {children}
  </div>
);

const Card: React.FC<{ tint: string; border: string; line: string; children: React.ReactNode; gap?: number }> = ({ tint, border, line, children, gap = 0 }) => (
  <div style={{ position: 'relative', borderRadius: 18, background: tint, border: `1px solid ${border}`, boxSizing: 'border-box', padding: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 1.5, background: `linear-gradient(90deg, ${line}, rgba(0,0,0,0) 70%)` }} />
    {children}
  </div>
);

const body: React.CSSProperties = { fontSize: 10.9, fontWeight: 300, lineHeight: '19.55px', color: '#E9E9E9' };

export const SessionPanel: React.FC<{ s: LessonState }> = ({ s }) => {
  const q = s.question;
  const exIn = s.explanationIn ?? 1;
  const answer = q ? q.answer.slice(0, Math.max(0, Math.floor(q.answerChars))) : '';
  const blocks = (
    <div style={abs(1577, 161, { width: 298, display: 'flex', flexDirection: 'column', gap: 24 })}>
      {q && q.in > 0.001 && (
        <div style={{ opacity: q.in, transform: `translateY(${(1 - q.in) * -8}px)` }}>
          <Section icon="message" color="#2dd4bf" text="Your question">
            <Card tint="rgba(20,184,166,0.035)" border="rgba(20,184,166,0.17)" line="rgba(45,212,191,0.5)" gap={12}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 11, lineHeight: '17.6px', fontStyle: 'italic', color: '#D4D4D4' }}>“{q.q}”</div>
                <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em', color: '#8F8F8F', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '2px 8px', flexShrink: 0, lineHeight: '13px' }}>STEP {q.step}</div>
              </div>
              {answer.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: '#8A8A8A', opacity: q.looking ?? 1 }}>
                  <span style={{ display: 'flex', gap: 4 }}>
                    {[0, 1, 2].map((i) => <span key={i} style={{ width: 4, height: 4, borderRadius: 2, background: '#2dd4bf', opacity: 0.25 + 0.75 * Math.abs(Math.sin(((q.looking ?? 0) * 40 + i * 5) / 6)) }} />)}
                  </span>
                  Looking at this step on your canvas…
                </div>
              ) : (
                <div style={{ ...body, opacity: q.answerIn ?? 1, transform: `translateY(${(1 - (q.answerIn ?? 1)) * 6}px)` }}>{answer}</div>
              )}
              {q.followUp && answer.length > 0 && (
                <div style={{ fontSize: 10.5, lineHeight: '16.8px', color: 'rgba(94,234,212,0.8)', opacity: q.followIn ?? 1 }}>{q.followUp}</div>
              )}
            </Card>
          </Section>
        </div>
      )}
      <Section icon="bulb" color="#f59e0b" text="Explanation">
        <Card tint="rgba(245,158,11,0.02)" border="rgba(255,255,255,0.05)" line="rgba(245,158,11,0.4)">
          <div style={{ ...body, opacity: exIn, transform: `translateY(${(1 - exIn) * 4}px)`, position: 'relative' }}>
            {/* full text reserves the height; the typed part sits on top */}
            <span style={{ visibility: s.explanationChars === undefined ? 'visible' : 'hidden' }}>{s.explanation}</span>
            {s.explanationChars !== undefined && (
              <span style={{ position: 'absolute', left: 0, top: 0, right: 0 }}>
                {s.explanation.slice(0, Math.max(0, Math.floor(s.explanationChars)))}
                {s.explanationChars < s.explanation.length && (
                  <span style={{ display: 'inline-block', width: 1.5, height: 13, background: '#f59e0b', marginLeft: 4, verticalAlign: 'middle', borderRadius: 1 }} />
                )}
              </span>
            )}
          </div>
        </Card>
      </Section>
      <Section icon="list" color={UI.ink} text="Navigation">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {s.steps.map((t, i) => {
            const st = stepStatus(i, s.active);
            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, boxSizing: 'border-box',
                  border: st === 'active' ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                  background: st === 'active' ? 'rgba(255,255,255,0.05)' : undefined,
                  boxShadow: st === 'active' ? '0 0 0 1px rgba(255,255,255,0.05)' : undefined,
                }}
              >
                <div
                  style={{
                    width: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontSize: 9, fontWeight: 700,
                    background: st === 'active' ? '#6366F1' : st === 'done' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                    color: st === 'active' ? '#FFFFFF' : '#8A8A8A',
                    boxShadow: st === 'active' ? '0 6px 14px rgba(0,0,0,0.4)' : undefined,
                  }}
                >
                  {st === 'done' ? <Icon name="check" size={10} color="#22c55e" stroke={3} /> : i + 1}
                </div>
                <div style={{ flex: 1, fontSize: 10.5, lineHeight: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: st === 'active' ? 700 : 400, color: st === 'active' ? '#FFFFFF' : '#C9C9C9' }}>{t}</div>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );

  return (
    <div style={{ fontFamily: fonts.sans, opacity: s.panelIn ?? 1 }}>
      <div style={abs(1557, 96, { width: 339, height: 886, borderRadius: 28, background: UI.card, border: `1px solid ${UI.panelBorder}`, boxSizing: 'border-box', boxShadow: '0 24px 60px rgba(0,0,0,0.55)' })} />
      <div style={abs(1576, 108, { width: 22, height: 22, borderRadius: 11, background: 'rgba(99,102,241,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
        <div style={{ width: 13, height: 13, borderRadius: 7, border: '1.6px solid #8B8BFA', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 4.6, height: 4.6, borderRadius: 3, background: '#8B8BFA' }} />
        </div>
      </div>
      <div style={abs(1605, 104, { fontSize: 13, fontWeight: 600, color: UI.ink, lineHeight: '16px' })}>SESSION</div>
      <div style={abs(1605, 123, { fontSize: 7, fontWeight: 700, letterSpacing: '0.15em', color: UI.violet, lineHeight: '10px' })}>{s.guide}</div>
      <div style={abs(1803, 107, { width: 31, height: 24, borderRadius: 12, border: '1px solid #2A2A2A', background: '#161616', boxSizing: 'border-box', fontSize: 9, fontFamily: fonts.mono, fontWeight: 700, color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
        {`${s.active + 1}/${s.steps.length}`}
      </div>
      <IconAt x={1860} y={119} name="x" size={16} color="#EDEDED" stroke={2.2} />
      <div style={abs(1558, 141, { width: 337, height: 1, background: UI.panelBorder })} />
      {blocks}
      <div style={abs(1558, 910, { width: 337, height: 1, background: UI.panelBorder })} />
      <IconAt x={1625} y={946} name="rotateCcw" size={14} color="#EDEDED" stroke={2.2} />
      <div style={abs(1639, 939, { fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: '#EDEDED', lineHeight: '14px' })}>REPLAY</div>
      <div
        style={abs(1738, 924, {
          width: 124, height: 44, borderRadius: 22,
          background: s.hover === 'resume' ? 'rgba(244,243,238,0.1)' : 'rgba(255,255,255,0.015)',
          boxShadow: s.hover === 'resume' ? '0 0 0 1px rgba(244,243,238,0.25)' : undefined,
        })}
      />
      <svg style={abs(1767, 940)} width={12} height={12} viewBox="0 0 24 24"><path d="M5 3 21 12 5 21Z" fill="#EDEDED" /></svg>
      <div style={abs(1787, 939, { fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: '#EDEDED', lineHeight: '14px' })}>RESUME</div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
/** The full lesson screen. `board` is drawn in app px on the canvas layer. */
export const LessonUI: React.FC<{ s: LessonState; board?: React.ReactNode; overlay?: React.ReactNode }> = ({ s, board, overlay }) => {
  const chrome = s.chromeIn ?? 1;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, background: UI.bg, overflow: 'hidden' }}>
      <CanvasTexture />
      <div style={abs(351, 0, { width: 1, height: 1080, background: '#1C1B19' })} />
      <div style={{ position: 'absolute', inset: 0 }}>{board}</div>
      <div style={{ opacity: chrome }}>
        <Sidebar s={s} />
        <HeaderPill s={s} />
        <Toolbar />
        <CanvasRail />
        <StepPills n={s.steps.length} active={s.active} />
        <ControlBar s={s} />
        <SessionPanel s={s} />
      </div>
      {overlay}
    </div>
  );
};
