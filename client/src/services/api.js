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

// Request Interceptor
API.interceptors.request.use(
  async (config) => {
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
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    
    // Check if the error is a proxy ECONNREFUSED (often appears as 502/504 or network error)
    if (!error.response && error.code === 'ERR_NETWORK') {
      console.error('[API] Network Error - Backend might be offline or proxy misconfigured');
    }

    const isRefreshRequest = originalRequest.url?.includes('/auth/refresh');
    const isAuthRoute = originalRequest.url?.includes('/auth/signin') || originalRequest.url?.includes('/auth/signup');
    
    // SEC-FIX: Use a header to track retries, as custom config properties can be stripped during cloning
    const isRetry = originalRequest._retry || originalRequest.headers?.['X-Retry'] === 'true';

    if (error.response?.status === 401 && !isRetry && !isRefreshRequest && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          // Flag queued requests as retries so they don't trigger another refresh loop
          originalRequest._retry = true;
          if (!originalRequest.headers) originalRequest.headers = {};
          originalRequest.headers['X-Retry'] = 'true';
          return API(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      if (!originalRequest.headers) originalRequest.headers = {};
      originalRequest.headers['X-Retry'] = 'true';
      isRefreshing = true;

      try {
        // Use direct axios for refresh to avoid triggering the same interceptor
        await axios.post(`${BASE_URL}/api/auth/refresh`, {}, { withCredentials: true });
        processQueue(null);
        return API(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default API;
export { BASE_URL };
