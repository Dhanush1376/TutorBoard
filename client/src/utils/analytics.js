import { posthog } from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

export const initPostHog = () => {
  try {
    // SEC-10: Only initialize analytics in production to avoid polluting data
    if (POSTHOG_KEY && import.meta.env.PROD) {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        autocapture: true,
        capture_pageview: true,
        persistence: 'localStorage',
      });
      import.meta.env.DEV && console.log('[Analytics] PostHog initialized ✅');
    }
  } catch (err) {
    console.warn('[Analytics] PostHog failed to initialize:', err);
  }
};

export const trackEvent = (eventName, properties = {}) => {
  try {
    if (POSTHOG_KEY && posthog) {
      posthog.capture(eventName, properties);
    }
  } catch (err) { /* silent */ }
};

export const identifyUser = (userId, properties = {}) => {
  try {
    if (POSTHOG_KEY && posthog) {
      posthog.identify(userId, properties);
    }
  } catch (err) { /* silent */ }
};

export const resetPostHog = () => {
  try {
    if (POSTHOG_KEY && posthog) {
      posthog.reset();
    }
  } catch (err) { /* silent */ }
};
