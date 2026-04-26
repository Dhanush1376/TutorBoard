import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

export const initPostHog = () => {
  // SEC-10: Only initialize analytics in production to avoid polluting data
  if (POSTHOG_KEY && import.meta.env.PROD) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: true,
      capture_pageview: true,
      persistence: 'localStorage',
    });
  } else if (!POSTHOG_KEY && import.meta.env.PROD) {
    console.warn('[Analytics] PostHog key missing in production.');
  }
};

export const trackEvent = (eventName, properties = {}) => {
  if (POSTHOG_KEY) {
    posthog.capture(eventName, properties);
  }
};

export const identifyUser = (userId, properties = {}) => {
  if (POSTHOG_KEY) {
    posthog.identify(userId, properties);
  }
};

export const resetPostHog = () => {
  if (POSTHOG_KEY) {
    posthog.reset();
  }
};
