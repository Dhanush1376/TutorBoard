/**
 * Processes a ReadableStream of SSE data, accumulating JSON boundaries
 * and emitting complete events.
 * 
 * @param {ReadableStreamDefaultReader} reader 
 * @param {Function} onEvent - (eventType, eventData, rawDataStr, isRawString) => void
 */
export async function processSSEStream(reader, onEvent) {
  const decoder = new TextDecoder();
  let buffer = '';
  let sseDataAccumulator = '';
  let lastEventType = 'message';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // decode with stream: true properly handles multibyte UTF-8 characters split across chunks
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed) {
        // Reset accumulator on empty line (standard SSE event separator)
        sseDataAccumulator = '';
        continue;
      }

      if (trimmed.startsWith('event: ')) {
        lastEventType = trimmed.slice(7).trim();
        continue;
      }

      if (!trimmed.startsWith('data: ')) continue;
      
      const dataStr = trimmed.slice(6);
      sseDataAccumulator += dataStr;
      
      // If it looks like a partial JSON object, wait for more lines
      if (sseDataAccumulator.trim().startsWith('{') && !sseDataAccumulator.trim().endsWith('}')) {
        continue;
      }

      const currentData = sseDataAccumulator;
      sseDataAccumulator = '';

      // Parse first, dispatch second: an exception thrown by the handler (an
      // `error` event, a bug) must propagate, never be mistaken for raw text.
      let eventData;
      try {
        eventData = JSON.parse(currentData);
      } catch {
        // Not JSON data, could be a raw string.
        // Emitting it as a fallback event gives callers the choice to ignore or process it.
        onEvent(lastEventType, currentData, dataStr, true);
        continue;
      }
      const eventType = (eventData && eventData.type) || lastEventType;
      onEvent(eventType, eventData, dataStr, false);
    }
  }
}
