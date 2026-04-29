import { PostHog } from 'posthog-node';
import dotenv from 'dotenv';

dotenv.config();

const posthog = new PostHog(
  process.env.POSTHOG_API_KEY || 'phc_placeholder',
  { host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com' }
);

/**
 * Tracks a pedagogical event
 */
export function trackEvent(userId, event, properties = {}) {
  try {
    if (!process.env.POSTHOG_API_KEY) return;
    
    posthog.capture({
      distinctId: userId || 'anonymous',
      event,
      properties: {
        ...properties,
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (err) {
    console.error('[PostHog] Tracking failed:', err.message);
  }
}

/**
 * Ensures all events are sent before shutdown
 */
export async function flushAnalytics() {
  await posthog.shutdown();
}

export default posthog;
