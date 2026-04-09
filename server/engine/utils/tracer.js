/**
 * Tracer — LLM Observability & Latency Monitoring
 */
import fs from 'fs';
import path from 'path';

const TRACE_FILE = path.join(process.cwd(), 'traces.json');

class Tracer {
  constructor() {
    this.enabled = true;
  }

  /**
   * Log an AI completion call
   */
  logCall({ agent, model, messages, response, latency, tokens, error = null }) {
    if (!this.enabled) return;

    const entry = {
      timestamp: new Date().toISOString(),
      agent,
      model,
      latencyMs: latency,
      tokenEstimate: tokens || this._estimateTokens(messages, response),
      status: error ? 'error' : 'success',
      error: error?.message || null,
      messages: messages.map(m => ({ role: m.role, length: m.content?.length || 0 })),
      responseLength: response?.content?.length || 0
    };

    // Append to local log for debugging
    try {
      let logs = [];
      if (fs.existsSync(TRACE_FILE)) {
        const content = fs.readFileSync(TRACE_FILE, 'utf8');
        logs = JSON.parse(content || '[]');
      }
      logs.push(entry);
      // Keep last 500 traces
      if (logs.length > 500) logs = logs.slice(-500);
      fs.writeFileSync(TRACE_FILE, JSON.stringify(logs, null, 2));
    } catch (err) {
      console.error('[Tracer] Failed to write log:', err.message);
    }

    console.log(`[Tracer] ${agent} | ${model} | ${latency}ms | ${entry.tokenEstimate} tokens | ${entry.status}`);
  }

  _estimateTokens(messages, response) {
    const inputChars = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
    const outputChars = response?.content?.length || 0;
    return Math.ceil((inputChars + outputChars) / 4);
  }
}

const tracer = new Tracer();
export default tracer;
