export const extractJsonResponse = (text) => {
  if (!text || typeof text !== 'string') return { content: text };
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return { content: text };

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.chat_response) {
      return {
        content: parsed.chat_response,
        artifact: parsed.artifact || null,
        canvasType: parsed.canvasType || parsed.artifact?.type || null
      };
    }
    if (parsed.text && typeof parsed.text === 'string') {
      return { content: parsed.text, artifact: parsed.artifact || null };
    }
  } catch (e) {
    const chatResponseMatch = trimmed.match(/"chat_response"\s*:\s*"([^"]*)"/);
    if (chatResponseMatch) {
      return { content: chatResponseMatch[1].replace(/\\n/g, '\n'), artifact: null };
    }
  }
  return { content: text };
};
