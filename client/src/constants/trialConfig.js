/**
 * trialConfig.js — Guest Trial Mode Configuration
 * Defines all limits and restrictions for unauthenticated (guest) users,
 * similar to how ChatGPT, Claude, and Perplexity handle free-tier access.
 */

export const TRIAL_LIMITS = {
  /** Total AI interactions allowed per guest browser session */
  MAX_MESSAGES: 10,

  /** Number of separate topic sessions a guest can start per visit */
  MAX_SESSIONS: 3,

  /** Character limit for guest input (vs 5000 for authenticated users) */
  MAX_INPUT_LENGTH: 500,

  /** Minimum seconds between consecutive guest messages */
  COOLDOWN_SECONDS: 15,

  /** Show a warning banner when this many messages have been used */
  WARNING_THRESHOLD: 7,

  /** Features that are locked/blocked for guest users */
  BLOCKED_FEATURES: [
    'upload',           // No file uploads
    'api_config',       // No custom API keys
    'history_save',     // No session persistence
    'export',           // No canvas export
    'test_me',          // No quiz mode (teaching mode)
    'deep',             // No deep visual dive mode
    'settings_account', // No account settings
    'settings_api',     // No API configuration settings
  ],
};

/**
 * Check if a specific feature is blocked for guest users.
 * @param {string} featureId — One of the BLOCKED_FEATURES identifiers
 * @returns {boolean}
 */
export const isFeatureBlocked = (featureId) => {
  return TRIAL_LIMITS.BLOCKED_FEATURES.includes(featureId);
};
