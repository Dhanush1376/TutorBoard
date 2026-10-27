export const extractJsonResponse = (text) => {
  if (!text || typeof text !== 'string') return { content: text };
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return { content: text };

  try {
    const parsed = JSON.parse(trimmed);
    const title = parsed.final_output?.meta?.topic || parsed.title || parsed.scene || parsed.topic || parsed.lesson_title || parsed.lesson || null;
    const canvasType = parsed.final_output?.meta?.renderer || parsed.canvasType || parsed.renderer || parsed.artifact?.type || parsed.type || null;
    const isVisualObj = parsed.final_output || parsed.visual_steps || parsed.animation_steps || parsed.artifact || parsed.steps || parsed.script || parsed.timeline || parsed.elements || parsed.objects;
    const artifact = isVisualObj ? (parsed.artifact || parsed.final_output || parsed) : null;

    if (parsed.chat_response) {
      return {
        content: parsed.chat_response,
        artifact,
        canvasType,
        title
      };
    }
    if (parsed.text && typeof parsed.text === 'string') {
      return { 
        content: parsed.text, 
        artifact,
        canvasType,
        title 
      };
    }
    if (isVisualObj) {
      return {
        content: parsed.chat_response || parsed.explanation || parsed.description || parsed.summary || parsed.content || 'Interactive lesson content is loaded in the canvas view.',
        artifact,
        canvasType,
        title
      };
    }
  } catch (e) {
    // SEC-38: Robust partial JSON extraction for multiple keys and escaped quotes
    const candidates = ['chat_response', 'text', 'content', 'response', 'answer'];
    for (const key of candidates) {
      const regex = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
      const match = trimmed.match(regex);
      if (match) {
        // Also try to extract a partial title candidate if present
        const titleMatch = trimmed.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const title = titleMatch ? titleMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : null;
        return { 
          content: match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'), 
          artifact: null,
          title
        };
      }
    }
  }
  return { content: text };
};

/**
 * Checks if a title is generic/placeholder text or instructional AI intent rather than an actual topic name.
 */
export const isGenericTitle = (title) => {
  if (!title || typeof title !== 'string') return true;
  const s = title.trim();
  if (s.length === 0) return true;

  // 1. Pedagogical / system intent prefixes or directives:
  // e.g. "Help student", "Help student understand...", "Helping student...", "Assist learner...", "Teach user..."
  if (/^(help|helping|assist|assisting|guide|guiding|teach|teaching|explain\s+to|explaining\s+to)\s+(the\s+)?(student|learner|user|pupil|class|me)\b/i.test(s)) {
    return true;
  }

  // 2. Pure intent or role words
  if (/^(help|student|learner|user|tutoring|assistant|tutor)$/i.test(s)) {
    return true;
  }

  // 3. Generic platform, session, or placeholder titles
  return /^(interactive\s+(lesson|visualization|guide|walkthrough|tutorial|model|artifact|ui|simulation|canvas|l(\.{2,3})?)|visual\s+(lesson|walkthrough|concept|artifact|visualization|simulation)|generated\s+visualization|learning\s+session|general\s+inquiry|general|new\s+chat|artifact|visualization|visual|lesson|untitled|ui|step\s+\d+|beat\s+\d+|component|concept|formula|solution|response|answer)$/i.test(s);
};

const capitalizeWord = (w) => {
  if (!w) return '';
  // Preserve well-known uppercase acronyms
  if (/^(2D|3D|AI|UI|ML|API|CSS|HTML|JS|TS|CPU|GPU|DNA|RNA|VSEPR|DSA|SQL|REST)$/i.test(w)) {
    return w.toUpperCase();
  }
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
};

/**
 * Formats any topic string into a punchy, clean 1 to 2 word title.
 * Removes verbose rhetorical prefixes, filler words, and stop words.
 * Guarantees zero trailing or embedded dots (...) so titles never truncate with dots.
 */
export const formatConciseTopic = (raw, fallback = 'Visual') => {
  if (!raw || typeof raw !== 'string') return fallback;
  let s = raw.trim();

  // Strip all dots (...), markdown headings, quotes, brackets, arrays, parentheses
  s = s.replace(/\.+/g, '')
       .replace(/^[#*\s_>`"']+|[#*\s_>`"']+$/g, '')
       .replace(/\[.*?\]/g, '')
       .replace(/\(.*?\)/g, '');

  if (isGenericTitle(s)) {
    // If the string starts with e.g. "Help student understand <Topic>", strip that intent prefix and check if a topic remains
    const strippedIntent = s.replace(/^(help|helping|assist|assisting|guide|guiding|teach|teaching|explain\s+to|explaining\s+to)\s+(the\s+)?(student|learner|user|pupil|class|me)\s+(to\s+)?(understand|learn|solve|explore|master|find|compute|visualize|see|with)?\s*(the|about|with)?\s*/i, '').trim();
    if (strippedIntent && !isGenericTitle(strippedIntent)) {
      s = strippedIntent;
    } else {
      return fallback;
    }
  }

  // Strip common verbose pedagogical prefixes
  s = s.replace(/^(help|helping|assist|guide|teach|explain\s+to)\s+(the\s+)?(student|learner|user|pupil|class|me)\s+(to\s+)?(understand|learn|solve|explore|master|find|compute|visualize|see|with)?\s*(the|about|with)?\s*/i, '')
       .replace(/^the\s+geometric\s+truth\s+behind\s+(the\s+)?/i, '')
       .replace(/^(why|how)\s+(a|an|the)?\s*/i, '')
       .replace(/^(an?\s+)?introduction\s+to\s+(the\s+)?/i, '')
       .replace(/^(an?\s+)?interactive\s+(guide|lesson|walkthrough|tutorial|exploring|model)\s+(to|on|of|about)\s+(the\s+)?/i, '')
       .replace(/^(a\s+)?deep\s+dive\s+into\s+(the\s+)?/i, '')
       .replace(/^understanding\s+(the\s+)?/i, '')
       .replace(/^exploring\s+(the\s+)?/i, '')
       .replace(/^visualizing\s+(the\s+)?/i, '')
       .replace(/^proof\s+of\s+(the\s+)?/i, '')
       .replace(/^concept\s+of\s+(the\s+)?/i, '');

  // Handle specific theorem/formula cases to get punchy 1-word or 2-word topic
  s = s.replace(/^pythagorean\s+(theorem|formula|proof)?/i, 'Pythagoras')
       .replace(/^pythagoras\s+(theorem|formula|proof)?/i, 'Pythagoras')
       .replace(/^quadratic\s+(formula|equation)?/i, 'Quadratic')
       .replace(/^distance\s+(formula|between.*)?/i, 'Distance');

  // Handle patterns like "Area of a parallelogram" -> "Parallelogram"
  const areaMatch = s.match(/^area\s+of\s+(?:an?\s+|the\s+)?([a-zA-Z0-9]+)/i);
  if (areaMatch) {
    s = areaMatch[1];
  }

  // Remove trailing clause fluff (e.g. "works on [5, 1, 4, 2, 8]", "adds up to 180°")
  s = s.replace(/\s+(works|works\s+on\s+.*|adds?\s+up\s+to\s+.*)$/i, '');
  s = s.replace(/[,;:.!?…]+$/, '').replace(/\.+/g, '').trim();

  if (!s || isGenericTitle(s)) return fallback;

  const words = s.split(/\s+/).filter(Boolean);

  const stopWords = new Set([
    'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'with', 'by',
    'from', 'about', 'into', 'through', 'behind', 'is', 'are', 'was', 'were', 'it', 'its', 'theorem', 'lesson',
    'help', 'student', 'learner', 'user', 'pupil', 'tutoring', 'guide', 'assist'
  ]);

  const contentWords = words.filter(w => !stopWords.has(w.toLowerCase()));

  // Prefer 1 word if possible ('even better if it is 1')
  if (contentWords.length === 1) {
    return capitalizeWord(contentWords[0]).replace(/\.+/g, '');
  }

  // If 2 or more content words: if combined length > 14 chars, take 1st word to avoid any truncation!
  if (contentWords.length >= 2) {
    const w1 = capitalizeWord(contentWords[0]).replace(/\.+/g, '');
    const w2 = capitalizeWord(contentWords[1]).replace(/\.+/g, '');
    if ((w1 + ' ' + w2).length <= 14) {
      return `${w1} ${w2}`;
    }
    return w1; // 1 punchy word!
  }

  return words.length > 0 ? capitalizeWord(words[0]).replace(/\.+/g, '') : fallback;
};

/**
 * While an answer is streaming, a code fence or display-math block may be open
 * (its closing marker hasn't arrived yet). Rendered as-is, the code shows as
 * prose and then jumps into a code block when the fence closes. Close whatever
 * is open, for display only — the stored text is never changed.
 */
export const closeOpenMarkdown = (text) => {
  if (!text) return text;
  let out = text;
  // Fenced code (CommonMark): a fence opens with 3+ backticks or tildes (indented
  // up to 3 spaces) and closes only with the same character, at least as long,
  // on a line of its own.
  let open = null; // e.g. '```' or '~~~~'
  for (const line of out.split('\n')) {
    const m = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!m) continue;
    const [, marker, rest] = m;
    if (!open) {
      open = marker;
    } else if (marker[0] === open[0] && marker.length >= open.length && !rest.trim()) {
      open = null;
    }
  }
  if (open) {
    // inside code nothing else is markdown, so this is the only thing to close
    return out + (out.endsWith('\n') ? '' : '\n') + open;
  }
  // display math: $$ ... $$
  const mathMarkers = (out.match(/\$\$/g) || []).length;
  if (mathMarkers % 2 === 1) out += '$$';
  return out;
};
