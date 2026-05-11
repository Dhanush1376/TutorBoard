import axios from 'axios';

// In development, we use the Vite proxy ('') to avoid cross-origin cookie issues on localhost.
// In production, we use the environment variable.
const BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL || '');
export const SOCKET_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

if (!import.meta.env.VITE_API_BASE_URL && import.meta.env.PROD) {
  console.warn('[API] VITE_API_BASE_URL is not defined. Falling back to relative paths.');
}

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

// Cache token to prevent redundant fetches
let cachedCsrfToken = null;

// Helper to fetch CSRF token from the API if cross-domain cookies cannot be read
export const fetchCsrfToken = async () => {
  try {
    const { data } = await axios.get(`${BASE_URL}/api/csrf-token`, { withCredentials: true });
    if (data.csrfToken) {
      cachedCsrfToken = data.csrfToken;
      // Set as default for all future requests
      API.defaults.headers.common['X-CSRF-Token'] = data.csrfToken;
      return data.csrfToken;
    }
  } catch (err) {
    console.error('[API] Failed to fetch CSRF token:', err);
  }
  return null;
};

// Request Interceptor
API.interceptors.request.use(
  async (config) => {
    // Add CSRF token for mutating requests
    const safeMethods = ['get', 'head', 'options'];
    if (!safeMethods.includes(config.method?.toLowerCase() || '')) {
      // 1. Try reading from Document Cookie (works for same-domain)
      let csrfToken = getCookie('tb-csrf-token');
      
      // 2. Try cached token (from cross-domain fetch)
      if (!csrfToken) csrfToken = cachedCsrfToken;

      // 3. Fallback to fetching it on-demand
      if (!csrfToken) {
        csrfToken = await fetchCsrfToken();
      }

      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const message = error.response?.data?.error || error.message || 'An unexpected error occurred';

    // Handle 401 Unauthorized errors
    const isRefreshRequest = originalRequest.url === '/api/auth/refresh';
    const isAuthRoute = originalRequest.url === '/api/auth/signin' || originalRequest.url === '/api/auth/signup';

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshRequest && !isAuthRoute) {
      console.log('[API] 401 detected, attempting token refresh...');
      if (isRefreshing) {
        console.log('[API] Refresh already in progress, queuing request...');
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => API(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the token using a clean axios call to avoid interceptor recursion
        console.log('[API] Calling /api/auth/refresh...');
        await axios.post(`${BASE_URL}/api/auth/refresh`, {}, { withCredentials: true });
        console.log('[API] Refresh successful, processing queue...');
        processQueue(null);
        return API(originalRequest);
      } catch (refreshError) {
        console.error('[API] Refresh FAILED:', refreshError.response?.status, refreshError.message);
        processQueue(refreshError);
        // Let the caller (AuthProvider) handle the unauthenticated state.
        // Do NOT hard-redirect here — it races with React's auth state management
        // and causes page flicker / infinite redirect loops on normal page refreshes.
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    console.error('[API Error]:', message);
    return Promise.reject(error);
  }
);

export default API;
export { BASE_URL };
