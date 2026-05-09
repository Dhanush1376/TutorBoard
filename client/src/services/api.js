import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'An unexpected error occurred';
    console.error('[API Error]:', message);
    return Promise.reject(error);
  }
);

export default API;
export { BASE_URL };
