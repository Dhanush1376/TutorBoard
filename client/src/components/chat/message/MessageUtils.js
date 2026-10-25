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
 * Checks if a title is generic/placeholder text rather than an actual topic name.
 */
export const isGenericTitle = (title) => {
  if (!title || typeof title !== 'string') return true;
  const s = title.trim();
  if (s.length === 0) return true;
  return /^(interactive\s+lesson|interactive\s+l(\.{2,3})?|visual\s+lesson|artifact|visualization|learning\s+session|lesson|untitled|ui|step\s+\d+|beat\s+\d+|component)$/i.test(s);
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
 * Formats any topic string into a punchy, clean 1 to 3 word title.
 * Removes verbose rhetorical prefixes, filler words, and stop words.
 */
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

  if (isGenericTitle(s)) return fallback;

  // Strip common verbose pedagogical prefixes
  s = s.replace(/^the\s+geometric\s+truth\s+behind\s+(the\s+)?/i, '')
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
    'from', 'about', 'into', 'through', 'behind', 'is', 'are', 'was', 'were', 'it', 'its', 'theorem', 'lesson'
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

  return capitalizeWord(words[0]).replace(/\.+/g, '');
};

export const DEFAULT_AGENT_STEPS = [
  'Analyzing problem',
  'Planning approach',
  'Designing visual',
  'Solving logic',
  'Generating steps',
  'Writing response',
  'Refining formulas',
  'Polishing answer',
  'Finalizing'
];

/**
 * Formats any step or action message into strictly 1 to 2 words.
 * Guarantees zero long sentences so users get punchy, fast status updates.
 */
export const formatShortAction = (text) => {
  if (!text || typeof text !== 'string') return 'Analyzing';
  const clean = text
    .replace(/^agent is\s+/i, '')
    .replace(/\.+/g, '')
    .replace(/query/i, '')
    .replace(/approach/i, '')
    .replace(/visual/i, '')
    .replace(/solution/i, '')
    .replace(/animation/i, '')
    .replace(/code/i, '')
    .replace(/response/i, '')
    .replace(/logic/i, '')
    .replace(/answer/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (/analyz/i.test(clean)) return 'Analyzing query';
  if (/search|research|web|source/i.test(clean)) return 'Searching web';
  if (/plan/i.test(clean)) return 'Planning approach';
  if (/design|layout|canvas|visual|scene/i.test(clean)) return 'Designing visual';
  if (/formula|math|comput|equation/i.test(clean)) return 'Finding solution';
  if (/animat|render|cinematic/i.test(clean)) return 'Crafting animation';
  if (/code|syntax|script/i.test(clean)) return 'Writing code';
  if (/draft|writ|answer|walkthrough/i.test(clean)) return 'Writing response';
  if (/reason|logic/i.test(clean)) return 'Reasoning logic';
  if (/finish|final|polish|ready/i.test(clean)) return 'Polishing answer';

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= 2) {
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return `${words[0].charAt(0).toUpperCase() + words[0].slice(1)} ${words[1].charAt(0).toUpperCase() + words[1].slice(1)}`;
};

/**
 * Detects the real, authentic action currently being performed by the agent.
 * Inspects stream contents, code fences, LaTeX equations, and progress states.
 */
export const detectCurrentAction = ({
  displayContent = '',
  isStreaming = false,
  searchPerformed = false,
  hasVisualArtifact = false,
  generationProgress = null,
  activeStepText = '',
}) => {
  // 1. Explicit backend stage has highest priority
  if (generationProgress?.label) {
    return formatShortAction(generationProgress.label) + '…';
  }

  // 2. Web search active before content
  if (searchPerformed && !displayContent) {
    return 'Searching web…';
  }

  // 3. Early phase: before tokens arrive
  if (isStreaming && !displayContent) {
    if (hasVisualArtifact) return 'Designing canvas…';
    return 'Analyzing question…';
  }

  // 4. Content is actively streaming — detect what the AI is actually generating!
  if (isStreaming && displayContent) {
    const recent = displayContent.slice(-320);

    // Actively writing code? (odd number of code fences ``` means caret is inside a code block)
    const codeBlockCount = (displayContent.match(/```/g) || []).length;
    if (codeBlockCount % 2 === 1) {
      return 'Writing code…';
    }

    // Actively formulating LaTeX math equations or formulas?
    if (/\$\$|\\\[|\\frac|\\sqrt|\\sum|\\int|\\begin\{|\\cdot|\b[xyz]\^2/.test(recent)) {
      return 'Solving formulas…';
    }

    // Actively structuring numbered steps or bullet lists?
    if (/(?:^|\n)\s*(?:\d+\.|\-|\*)\s+[A-Z]/m.test(recent.slice(-160))) {
      return 'Structuring steps…';
    }

    // Actively building markdown comparison or data tables?
    if (/\|(?:\s*-+\s*\|)+/.test(recent)) {
      return 'Building table…';
    }

    // Visual artifact being generated alongside response
    if (hasVisualArtifact && displayContent.length < 320) {
      return 'Designing visual…';
    }

    // Concluding remarks
    if (/In summary|To conclude|In conclusion|Overall,|To recap|Key takeaway/i.test(recent)) {
      return 'Polishing answer…';
    }

    // Progressive prose generation stages
    if (displayContent.length < 120) {
      return 'Planning response…';
    } else if (displayContent.length < 300) {
      return 'Explaining concepts…';
    } else if (displayContent.length < 650) {
      return 'Synthesizing details…';
    } else {
      return 'Refining solution…';
    }
  }

  // 5. Fallback to active step text or generic
  if (activeStepText) {
    return formatShortAction(activeStepText) + '…';
  }

  return 'Thinking…';
};
