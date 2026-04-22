import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

export const initPostHog = () => {
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: true,
      capture_pageview: true,
      persistence: 'localStorage',
    });
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
