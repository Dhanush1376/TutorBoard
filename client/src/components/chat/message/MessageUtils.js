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
