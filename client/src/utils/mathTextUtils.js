import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Extracts clean, readable text from a DOM element or Selection Range.
 * When preserveMath is true, math formulas rendered by KaTeX retain their LaTeX
 * delimiters ($...$) so that consumers (like sticky notes) can render real math formulas.
 */
export function extractCleanText(nodeOrRange, { preserveMath = false } = {}) {
  if (!nodeOrRange) return '';

  let container;
  if (nodeOrRange instanceof Range) {
    container = nodeOrRange.cloneContents();
  } else if (nodeOrRange instanceof Node) {
    container = nodeOrRange.cloneNode(true);
  } else {
    return String(nodeOrRange);
  }

  // Handle KaTeX elements in the cloned DOM:
  // KaTeX structures formulas with:
  // 1. <annotation encoding="application/x-tex">raw LaTeX</annotation> (inside .katex-mathml)
  // 2. <span class="katex-html" aria-hidden="true">...</span> (visual tokens with spans/breaks)
  const katexNodes = container.querySelectorAll('.katex');
  katexNodes.forEach((k) => {
    // Try to get raw tex annotation if available
    const annotation = k.querySelector('annotation');
    let formulaText = '';
    const rawTex = annotation?.textContent?.trim() || '';

    if (preserveMath && rawTex) {
      formulaText = `$${rawTex}$`;
    } else if (rawTex) {
      formulaText = cleanTeXFormula(rawTex);
    } else {
      // Otherwise, pull text from .katex-html without arbitrary newlines
      const htmlPart = k.querySelector('.katex-html') || k;
      formulaText = htmlPart.textContent || '';
    }
    // Clean up formula text
    formulaText = formulaText.replace(/\s+/g, ' ').trim();
    const replacement = document.createTextNode(` ${formulaText} `);
    k.parentNode?.replaceChild(replacement, k);
  });

  // Extract textContent and normalize whitespace
  const rawText = container.textContent || '';
  return cleanFormulaText(rawText);
}

/**
 * Converts common LaTeX constructs into human-readable math symbols
 */
function cleanTeXFormula(tex) {
  if (!tex) return '';
  return tex
    .replace(/\\left\s*([([{|])/g, '$1')
    .replace(/\\right\s*([)\]}|])/g, '$1')
    .replace(/\\times/g, ' × ')
    .replace(/\\cdot/g, ' · ')
    .replace(/\\div/g, ' ÷ ')
    .replace(/\\pm/g, ' ± ')
    .replace(/\\neq/g, ' ≠ ')
    .replace(/\\le(q)?/g, ' ≤ ')
    .replace(/\\ge(q)?/g, ' ≥ ')
    .replace(/\\approx/g, ' ≈ ')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\^\{([^}]+)\}/g, '^($1)')
    .replace(/_\{([^}]+)\}/g, '_$1')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^}]+)\}/g, '$1')
    .replace(/\\quad/g, ' ')
    .replace(/\\qquad/g, '  ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, '');
}

/**
 * Cleans multi-line broken formulas that got pasted into a single coherent line.
 * e.g.:
 * "Area\n=\n(\nπ\nr\n)\n×" => "Area = (πr) ×"
 */
export function cleanFormulaText(text) {
  if (!text) return '';

  // If text contains single characters / symbols on their own lines (typical of KaTeX spans)
  // join them properly:
  const lines = text.split(/\r?\n/);
  
  // Detect if lines are predominantly tiny fragments (1-4 characters)
  const isFragmented = lines.length > 3 && lines.filter(l => l.trim().length > 0 && l.trim().length <= 3).length / lines.length > 0.45;

  if (isFragmented) {
    const joined = lines
      .map(l => l.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s*([=×+\-*/()²³_])\s*/g, ' $1 ')
      .replace(/\s+/g, ' ')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .trim();
    return joined;
  }

  // Otherwise, normalize standard multi-whitespace while preserving intentional paragraphs
  return text
    .split(/\n{2,}/)
    .map(para => para.replace(/[ \t]+/g, ' ').trim())
    .join('\n\n')
    .trim();
}

/**
 * Renders an inline LaTeX formula via KaTeX to an HTML string.
 */
export function renderKaTeXHTML(tex, displayMode = false) {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch (err) {
    console.warn('Failed to render KaTeX formula:', err);
    return tex;
  }
}

/**
 * Checks if a string contains LaTeX math tokens or math delimiters ($...$, \frac, \pi, etc.)
 */
export function hasMathMarkup(str) {
  if (!str) return false;
  return (
    /\$\$[\s\S]+?\$\$/.test(str) ||
    /\$[^$\n]+\$/.test(str) ||
    /\\(frac|sqrt|times|cdot|pi|theta|alpha|beta|pm|neq|le|ge|sum|int|infty|mathbf|mathrm|text)\b/.test(str) ||
    /(\b[a-zA-Z]+\b\s*=\s*[\s\S]*?[×÷·²³π\\])/.test(str)
  );
}

/**
 * Converts text containing math (either $...$, \formula, or unicode formulas like "Area = (πr) × r = πr²")
 * into formatted HTML segments so it looks like authentic mathematical notation in sticky notes.
 */
export function formatNoteMathText(text) {
  if (!text) return '';

  // Check if string contains explicit LaTeX blocks $...$ or $$...$$
  if (/\$[^$]+\$/.test(text) || /\$\$[\s\S]+?\$\$/.test(text)) {
    // Replace $$...$$ display math
    let formatted = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
      return `<div class="tb-note-math-display">${renderKaTeXHTML(tex.trim(), true)}</div>`;
    });
    // Replace $...$ inline math
    formatted = formatted.replace(/\$([^$\n]+?)\$/g, (_, tex) => {
      return `<span class="tb-note-math-inline">${renderKaTeXHTML(tex.trim(), false)}</span>`;
    });
    return formatted;
  }

  // Check if the whole text or a line is a standalone LaTeX command without $ (e.g. \frac{1}{2} or A = \pi r^2)
  if (/\\(frac|sqrt|times|cdot|pi|theta|alpha|beta|pm|neq|le|ge|sum|int|infty)\b/.test(text)) {
    return `<span class="tb-note-math-inline">${renderKaTeXHTML(text.trim(), false)}</span>`;
  }

  // Check if the text is a clean mathematical formula expression with math symbols:
  // e.g. "Area = (πr) × r = πr²" or "Base = 1/2 × 2πr = πr"
  // If it's a recognized formula pattern, we can render it cleanly with KaTeX:
  const formulaMatch = text.match(/^([A-Za-z\s]+=\s*[^.\n]+)$/);
  if (formulaMatch && /[=×·÷π²³√_]/.test(text)) {
    // Convert unicode formula back to TeX for crisp KaTeX rendering
    const convertedTeX = text
      .replace(/π/g, '\\pi ')
      .replace(/×/g, '\\times ')
      .replace(/·/g, '\\cdot ')
      .replace(/÷/g, '\\div ')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/√\(([^)]+)\)/g, '\\sqrt{$1}')
      .replace(/√([0-9a-zA-Z]+)/g, '\\sqrt{$1}')
      .replace(/\(([^)]+)\/([^)]+)\)/g, '\\frac{$1}{$2}');

    return `<span class="tb-note-math-inline">${renderKaTeXHTML(convertedTeX, false)}</span>`;
  }

  return null;
}
