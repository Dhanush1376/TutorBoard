import { PostHog } from 'posthog-node';

const client = process.env.POSTHOG_API_KEY 
  ? new PostHog(process.env.POSTHOG_API_KEY, { host: 'https://app.posthog.com' })
  : null;

if (client) {
  console.log('✅ [Analytics] PostHog initialized');
}

export const trackEvent = (userId: string, event: string, properties: Record<string, any> = {}): void => {
  if (!client) return;
  try {
    client.capture({
      distinctId: userId,
      event,
      properties: {
        ...properties,
        $set: { last_active: new Date().toISOString() }
      }
    });
  } catch (err) {
    console.warn('[Analytics] Failed to track event:', err);
  }
};

export const flushAnalytics = async (): Promise<void> => {
  if (!client) return;
  try {
    await client.shutdown();
    console.log('[Analytics] Flushed and shutdown successfully');
  } catch (err) {
    console.error('[Analytics] Shutdown failed:', err);
  }
};

export default { trackEvent, flushAnalytics };
