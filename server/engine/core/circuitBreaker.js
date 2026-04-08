/**
 * AI Circuit Breaker
 * Tracks provider health. If a provider consistently fails or returns 429/402,
 * the circuit "OPEN"s to instantly failover without blocking UI.
 */

const COOLDOWN_MS = 60000; // 60 seconds before trying a provider again

class CircuitBreaker {
  constructor() {
    this.providers = {
      google: { state: 'CLOSED', failures: 0, nextRetry: 0 },
      openrouter: { state: 'CLOSED', failures: 0, nextRetry: 0 }
    };
  }

  /**
   * Check if provider is healthy enough to be called
   */
  isAvailable(provider) {
    if (!this.providers[provider]) return false;
    
    const p = this.providers[provider];
    
    // If OPEN, check if cooldown finished
    if (p.state === 'OPEN') {
      if (Date.now() >= p.nextRetry) {
        console.log(`[CircuitBreaker] ${provider} cooldown finished. Entering HALF_OPEN.`);
        p.state = 'HALF_OPEN';
        return true; // allow one test request
      }
      return false;
    }
    
    return true; // CLOSED or HALF_OPEN
  }

  /**
   * Report success to close circuits
   */
  reportSuccess(provider) {
    if (this.providers[provider]) {
      this.providers[provider].failures = 0;
      this.providers[provider].state = 'CLOSED';
    }
  }

  /**
   * Report failure to potentially trip the breaker
   */
  reportFailure(provider, statusCode) {
    if (!this.providers[provider]) return;
    
    const p = this.providers[provider];
    p.failures += 1;

    // 402/429 are hard quota limits. Instantly open circuit.
    if (statusCode === 429 || statusCode === 402 || p.failures >= 4) {
      p.state = 'OPEN';
      p.nextRetry = Date.now() + COOLDOWN_MS;
      console.warn(`[CircuitBreaker] ⚠️ ${provider} circuit is OPEN! Cooldown: ${COOLDOWN_MS/1000}s`);
    } else if (p.state === 'HALF_OPEN') {
      // Failed during test phase, slam it shut again
      p.state = 'OPEN';
      p.nextRetry = Date.now() + COOLDOWN_MS;
      console.warn(`[CircuitBreaker] ⚠️ ${provider} failed during HALF_OPEN phase. Tripped back to OPEN.`);
    }
  }

  /**
   * Force reset a provider
   */
  reset(provider) {
    if (this.providers[provider]) {
      this.providers[provider] = { state: 'CLOSED', failures: 0, nextRetry: 0 };
    }
  }
}

export const circuitBreaker = new CircuitBreaker();
