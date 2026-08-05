/**
 * AI Circuit Breaker v3 — Stateful Three-Phase Health Tracker
 * 
 * Proper CLOSED → OPEN → HALF_OPEN state machine with per-provider
 * health metrics for the monitoring dashboard and adaptive router.
 * 
 * Trip threshold: 3 consecutive failures (or instant on 402/429)
 * Cooldown: 60 seconds before HALF_OPEN probe
 */

// Removed container import

const DEFAULT_COOLDOWN_MS = 60_000;
const GROQ_COOLDOWN_MS = 90_000; // Groq needs more time to reset rate limits
const TRIP_THRESHOLD = 3;
const REDIS_KEY_PREFIX = 'cb:provider:';

class CircuitBreaker {
  constructor() {
    this.providers = {};
    const ids = ['openrouter', 'openai', 'google', 'anthropic', 'groq', 'deepseek', 'custom'];
    for (const id of ids) {
      this.providers[id] = this._newProviderState(id);
    }
    
    // Attempt local state hydration from Redis if possible
    this._syncFromRedis();
  }

  async _syncFromRedis() {
    // Redis sync removed for simplicity
  }

  async _persistToRedis(provider) {
    // Redis persistence removed for simplicity
  }

  _newProviderState(id) {
    return {
      id,
      // State machine
      state: 'CLOSED',       // CLOSED | OPEN | HALF_OPEN
      consecutiveFailures: 0,
      nextRetryAt: 0,
      cooldownMs: id === 'groq' ? GROQ_COOLDOWN_MS : DEFAULT_COOLDOWN_MS,

      // Health metrics (rolling)
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      latencySum: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastErrorType: null,
    };
  }

  /**
   * Check if provider is healthy enough to receive requests
   */
  isAvailable(provider) {
    if (!this.providers[provider]) {
      this.providers[provider] = this._newProviderState(provider);
    }
    const p = this.providers[provider];

    if (p.state === 'CLOSED' || p.state === 'HALF_OPEN') return true;

    // OPEN — check if cooldown has elapsed
    if (p.state === 'OPEN' && Date.now() >= p.nextRetryAt) {
      p.state = 'HALF_OPEN';
      console.log(`[CircuitBreaker] ${provider}: OPEN → HALF_OPEN (cooldown elapsed, allowing probe)`);
      this._persistToRedis(provider);
      return true;
    }

    return false; // still OPEN
  }

  /**
   * Report a successful request
   */
  reportSuccess(provider, latencyMs = 0) {
    if (!this.providers[provider]) {
      this.providers[provider] = this._newProviderState(provider);
    }
    const p = this.providers[provider];

    p.totalRequests++;
    p.totalSuccesses++;
    p.consecutiveFailures = 0;
    p.lastSuccessAt = Date.now();
    if (latencyMs > 0) p.latencySum += latencyMs;

    if (p.state === 'HALF_OPEN') {
      console.log(`[CircuitBreaker] ✅ ${provider}: HALF_OPEN → CLOSED (probe succeeded)`);
    }
    p.state = 'CLOSED';
    this._persistToRedis(provider);
  }

  /**
   * Report a failed request — may trip the breaker
   */
  reportFailure(provider, statusCode = 500, errorType = 'unknown') {
    if (!this.providers[provider]) {
      this.providers[provider] = this._newProviderState(provider);
    }
    const p = this.providers[provider];

    p.totalRequests++;
    p.totalFailures++;
    p.consecutiveFailures++;
    p.lastFailureAt = Date.now();
    p.lastErrorType = errorType;

    const cooldown = p.cooldownMs || DEFAULT_COOLDOWN_MS;

    // HALF_OPEN failed — slam back to OPEN
    if (p.state === 'HALF_OPEN') {
      p.state = 'OPEN';
      p.nextRetryAt = Date.now() + cooldown;
      console.warn(`[CircuitBreaker] ⚠️ ${provider}: HALF_OPEN → OPEN (probe failed, cooldown ${cooldown / 1000}s)`);
      this._persistToRedis(provider);
      return;
    }

    // 402/429 are hard quota/rate limits — instant trip
    const instantTrip = statusCode === 429 || statusCode === 402;
    
    if (instantTrip || p.consecutiveFailures >= TRIP_THRESHOLD) {
      p.state = 'OPEN';
      p.nextRetryAt = Date.now() + cooldown;
      const reason = instantTrip ? `HTTP ${statusCode}` : `${p.consecutiveFailures} consecutive failures`;
      console.warn(`[CircuitBreaker] ⚠️ ${provider}: CLOSED → OPEN (${reason}, cooldown ${cooldown / 1000}s)`);
      this._persistToRedis(provider);
    } else {
      // Just normal failure increment, still persist
      this._persistToRedis(provider);
    }
  }

  /**
   * Force reset a provider circuit
   */
  reset(provider) {
    if (this.providers[provider]) {
      this.providers[provider] = this._newProviderState(provider);
      console.log(`[CircuitBreaker] 🔄 ${provider}: Force reset to CLOSED`);
      this._persistToRedis(provider);
    }
  }

  /**
   * Get health metrics for a single provider
   */
  getProviderHealth(provider) {
    const p = this.providers[provider];
    if (!p) return null;

    const successRate = p.totalRequests > 0
      ? Math.round((p.totalSuccesses / p.totalRequests) * 100) / 100
      : 1.0;

    const avgLatencyMs = p.totalSuccesses > 0
      ? Math.round(p.latencySum / p.totalSuccesses)
      : 0;

    return {
      provider,
      state: p.state,
      consecutiveFailures: p.consecutiveFailures,
      totalRequests: p.totalRequests,
      totalFailures: p.totalFailures,
      successRate,
      avgLatencyMs,
      lastSuccessAt: p.lastSuccessAt,
      lastFailureAt: p.lastFailureAt,
      lastErrorType: p.lastErrorType,
      nextRetryAt: p.state === 'OPEN' ? p.nextRetryAt : null,
      cooldownRemainingMs: p.state === 'OPEN' ? Math.max(0, p.nextRetryAt - Date.now()) : 0,
    };
  }

  /**
   * Get health report for ALL providers (for Settings dashboard)
   */
  getHealthReport() {
    const report = {};
    for (const id of Object.keys(this.providers)) {
      report[id] = this.getProviderHealth(id);
    }
    return report;
  }

  /**
   * Get compact status for all providers
   */
  getStatus() {
    const status = {};
    for (const [id, p] of Object.entries(this.providers)) {
      status[id] = {
        state: p.state,
        ok: p.state === 'CLOSED',
        successRate: p.totalRequests > 0 ? Math.round((p.totalSuccesses / p.totalRequests) * 100) : 100,
      };
    }
    return status;
  }
}

export const circuitBreaker = new CircuitBreaker();

/**
 * Functional wrapper for circuit-protected execution
 */
export const withCircuitBreaker = async (provider, fn) => {
  if (!circuitBreaker.isAvailable(provider)) {
    throw new Error(`CIRCUIT_OPEN: ${provider} is currently unavailable.`);
  }

  const startTime = Date.now();
  try {
    const result = await fn();
    circuitBreaker.reportSuccess(provider, Date.now() - startTime);
    return result;
  } catch (err) {
    const statusCode = err.response?.status || err.status || 500;
    circuitBreaker.reportFailure(provider, statusCode, err.message);
    throw err;
  }
};
