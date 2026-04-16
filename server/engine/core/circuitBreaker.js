/**
 * AI Circuit Breaker v3 — Stateful Three-Phase Health Tracker
 * 
 * Proper CLOSED → OPEN → HALF_OPEN state machine with per-provider
 * health metrics for the monitoring dashboard and adaptive router.
 * 
 * Trip threshold: 3 consecutive failures (or instant on 402/429)
 * Cooldown: 60 seconds before HALF_OPEN probe
 */

const COOLDOWN_MS = 60_000;
const TRIP_THRESHOLD = 3;

class CircuitBreaker {
  constructor() {
    this.providers = {};
    for (const id of ['openrouter', 'openai', 'google', 'anthropic', 'custom']) {
      this.providers[id] = this._newProviderState();
    }
  }

  _newProviderState() {
    return {
      // State machine
      state: 'CLOSED',       // CLOSED | OPEN | HALF_OPEN
      consecutiveFailures: 0,
      nextRetryAt: 0,

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
    const p = this.providers[provider];
    if (!p) return false;

    if (p.state === 'CLOSED' || p.state === 'HALF_OPEN') return true;

    // OPEN — check if cooldown has elapsed
    if (p.state === 'OPEN' && Date.now() >= p.nextRetryAt) {
      p.state = 'HALF_OPEN';
      console.log(`[CircuitBreaker] ${provider}: OPEN → HALF_OPEN (cooldown elapsed, allowing probe)`);
      return true;
    }

    return false; // still OPEN
  }

  /**
   * Report a successful request
   */
  reportSuccess(provider, latencyMs = 0) {
    const p = this.providers[provider];
    if (!p) return;

    p.totalRequests++;
    p.totalSuccesses++;
    p.consecutiveFailures = 0;
    p.lastSuccessAt = Date.now();
    if (latencyMs > 0) p.latencySum += latencyMs;

    if (p.state === 'HALF_OPEN') {
      console.log(`[CircuitBreaker] ✅ ${provider}: HALF_OPEN → CLOSED (probe succeeded)`);
    }
    p.state = 'CLOSED';
  }

  /**
   * Report a failed request — may trip the breaker
   */
  reportFailure(provider, statusCode = 500, errorType = 'unknown') {
    const p = this.providers[provider];
    if (!p) return;

    p.totalRequests++;
    p.totalFailures++;
    p.consecutiveFailures++;
    p.lastFailureAt = Date.now();
    p.lastErrorType = errorType;

    // HALF_OPEN failed — slam back to OPEN
    if (p.state === 'HALF_OPEN') {
      p.state = 'OPEN';
      p.nextRetryAt = Date.now() + COOLDOWN_MS;
      console.warn(`[CircuitBreaker] ⚠️ ${provider}: HALF_OPEN → OPEN (probe failed, cooldown ${COOLDOWN_MS / 1000}s)`);
      return;
    }

    // 402/429 are hard quota/rate limits — instant trip
    const instantTrip = statusCode === 429 || statusCode === 402;
    
    if (instantTrip || p.consecutiveFailures >= TRIP_THRESHOLD) {
      p.state = 'OPEN';
      p.nextRetryAt = Date.now() + COOLDOWN_MS;
      const reason = instantTrip ? `HTTP ${statusCode}` : `${p.consecutiveFailures} consecutive failures`;
      console.warn(`[CircuitBreaker] ⚠️ ${provider}: CLOSED → OPEN (${reason}, cooldown ${COOLDOWN_MS / 1000}s)`);
    }
  }

  /**
   * Force reset a provider circuit
   */
  reset(provider) {
    if (this.providers[provider]) {
      this.providers[provider] = this._newProviderState();
      console.log(`[CircuitBreaker] 🔄 ${provider}: Force reset to CLOSED`);
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
