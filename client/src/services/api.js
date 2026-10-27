import axios from 'axios';

// In development, we use the Vite proxy ('') to avoid cross-origin cookie issues on localhost.
// In production, we use the environment variable.
const BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');

// V-4 FIX: Use relative path for sockets in dev to ensure proxy/cookie consistency
export const SOCKET_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');

const API = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// ── One guest identity per browser ───────────────────────────────────────────
// A guest's chats belong to the guest id the server issues to the first request
// that arrives without one. Requests sent together before that answer each got
// a DIFFERENT new id, the last one stored won, and every chat saved under the
// others disappeared from the guest's history. So, until this browser has an
// identity, requests that can create one go one at a time.
const MINTING_ROUTE = /\/api\/(sessions\/?(\?|$)|chat\/|artifact\/(save|generate|edit|modify))/;

const hasStoredIdentity = () => {
  try {
    return Boolean(localStorage.getItem('tb-token') || localStorage.getItem('tb-guest-token'));
  } catch (e) {
    return true; // no storage: nothing to coordinate
  }
};

/** Keep the guest token the server sent (a new identity, or the same one renewed). */
export const storeGuestToken = (headers) => {
  try {
    const token = typeof headers?.get === 'function'
      ? headers.get('x-guest-token')
      : headers?.['x-guest-token'] || headers?.['X-Guest-Token'];
    if (token && typeof localStorage !== 'undefined') localStorage.setItem('tb-guest-token', token);
  } catch (e) { /* storage blocked */ }
};

let identityQueue = Promise.resolve();
/**
 * Before a request that may create a guest identity: resolves to a `release`
 * to call once its response headers (and any new guest token) have arrived.
 * Free when an identity is already stored.
 */
export const acquireIdentitySlot = async (url = '') => {
  if (hasStoredIdentity() || !MINTING_ROUTE.test(url)) return () => {};
  let release;
  const turn = new Promise((resolve) => { release = resolve; });
  const previous = identityQueue;
  identityQueue = previous.then(() => turn);
  await previous;
  return release;
};

// Helper to read cookies in the browser
export const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

let cachedCsrfToken = null;
let csrfFetchPromise = null;

/**
 * fetchCsrfToken - Fetches the CSRF token from the backend.
 * Added retry logic and improved error handling for production-grade stability.
 */
export const fetchCsrfToken = async (retries = 3) => {
  if (csrfFetchPromise) return csrfFetchPromise;

  csrfFetchPromise = (async () => {
    for (let i = 0; i < retries; i++) {
      try {
        const { data } = await axios.get(`${BASE_URL}/api/csrf-token`, { 
          withCredentials: true,
          timeout: 5000 
        });
        if (data.csrfToken) {
          cachedCsrfToken = data.csrfToken;
          API.defaults.headers.common['X-CSRF-Token'] = data.csrfToken;
          return data.csrfToken;
        }
      } catch (err) {
        if (i === retries - 1) {
          console.error('[API] Final attempt to fetch CSRF token failed:', err.message);
        } else {
          const delay = Math.pow(2, i) * 1000;
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    return null;
  })().finally(() => {
    csrfFetchPromise = null;
  });

  return csrfFetchPromise;
};

// Helper to get auth & CSRF headers for direct fetch calls
export const getAuthHeaders = () => {
  const headers = {};
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('tb-token') : null;
    if (token && token !== 'verified' && token !== 'guest') {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const guestToken = typeof localStorage !== 'undefined' ? localStorage.getItem('tb-guest-token') : null;
    if (guestToken) {
      headers['X-Guest-Token'] = guestToken;
    }
  } catch (e) {}
  const csrf = getCookie('tb-csrf-token') || cachedCsrfToken;
  if (csrf) {
    headers['X-CSRF-Token'] = csrf;
  }
  return headers;
};

// Request Interceptor
API.interceptors.request.use(
  async (config) => {
    // 0. No identity yet: wait for the turn to (possibly) create one
    const releaseIdentity = await acquireIdentitySlot(config.url || '');
    config._releaseIdentity = releaseIdentity;

    // 1. Attach Authorization header or Guest Token if stored
    try {
      const storedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('tb-token') : null;
      if (storedToken && storedToken !== 'verified' && storedToken !== 'guest') {
        config.headers = config.headers || {};
        if (!config.headers['Authorization']) {
          config.headers['Authorization'] = `Bearer ${storedToken}`;
        }
      }
      const storedGuestToken = typeof localStorage !== 'undefined' ? localStorage.getItem('tb-guest-token') : null;
      if (storedGuestToken) {
        config.headers = config.headers || {};
        if (!config.headers['X-Guest-Token']) {
          config.headers['X-Guest-Token'] = storedGuestToken;
        }
      }
    } catch (e) {}

    // 2. Attach CSRF token on mutating methods
    const safeMethods = ['get', 'head', 'options'];
    if (!safeMethods.includes(config.method?.toLowerCase() || '')) {
      let csrfToken = getCookie('tb-csrf-token') || cachedCsrfToken;
      
      if (!csrfToken) {
        csrfToken = await fetchCsrfToken(1); // Fast single-retry attempt
      }

      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// Response Interceptor
API.interceptors.response.use(
  (response) => {
    // Capture guest token issued by backend into localStorage as fallback
    storeGuestToken(response.headers);
    response.config?._releaseIdentity?.();
    return response;
  },
  async (error) => {
    const originalRequest = error.config || {};
    if (error.response) storeGuestToken(error.response.headers);
    originalRequest._releaseIdentity?.();
    // a stored guest token the server cannot read (forged / corrupted) can never
    // be recovered: drop it so the next request gets a working identity
    if (error.response?.data?.code === 'INVALID_GUEST_TOKEN') {
      try { localStorage.removeItem('tb-guest-token'); } catch (e) { /* storage blocked */ }
    }
    
    // Check if the error is a proxy ECONNREFUSED (often appears as 502/504 or network error)
    if (!error.response && error.code === 'ERR_NETWORK') {
      console.error('[API] Network Error - Backend might be offline or proxy misconfigured');
    }

    // Platform-wide conditions (maintenance, unverified email) are announced once,
    // not once per failing request; App shows them as a single toast.
    const noticeCode = error.response?.data?.code;
    if (noticeCode === 'MAINTENANCE' || noticeCode === 'EMAIL_VERIFICATION_REQUIRED' || noticeCode === 'ACCOUNT_DISABLED') {
      const now = Date.now();
      if (!lastNoticeAt[noticeCode] || now - lastNoticeAt[noticeCode] > 30000) {
        lastNoticeAt[noticeCode] = now;
        window.dispatchEvent(new CustomEvent('tb-api-notice', { detail: { code: noticeCode, message: error.response.data.error } }));
      }
    }

    const isRefreshRequest = originalRequest.url?.includes('/auth/refresh');
    // 401s from these mean "wrong credentials / code", not "access token expired"
    const isAuthRoute = ['/auth/signin', '/auth/signup', '/auth/exchange', '/auth/password/', '/auth/logout'].some((p) => originalRequest.url?.includes(p));
    
    // SEC-FIX: Use a header to track retries, as custom config properties can be stripped during cloning
    const isRetry = originalRequest._retry || originalRequest.headers?.['X-Retry'] === 'true';

    if (error.response?.status === 401 && !isRetry && !isRefreshRequest && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          // Flag queued requests as retries so they don't trigger another refresh loop
          originalRequest._retry = true;
          if (!originalRequest.headers) originalRequest.headers = {};
          originalRequest.headers['X-Retry'] = 'true';
          if (newToken) {
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          }
          return API(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      if (!originalRequest.headers) originalRequest.headers = {};
      originalRequest.headers['X-Retry'] = 'true';
      isRefreshing = true;

      try {
        // Use direct axios for refresh to avoid triggering the same interceptor
        const refreshRes = await axios.post(`${BASE_URL}/api/auth/refresh`, {}, { withCredentials: true });
        const newToken = refreshRes.data?.token;
        if (newToken) {
          try {
            localStorage.setItem('tb-token', newToken);
          } catch (e) {}
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        }
        processQueue(null, newToken);
        return API(originalRequest);
      } catch (refreshError) {
        try {
          localStorage.removeItem('tb-token');
        } catch (e) {}
        processQueue(refreshError);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

const lastNoticeAt = {};

export default API;
export { BASE_URL };
