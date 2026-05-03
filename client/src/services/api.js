import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!BASE_URL && import.meta.env.PROD) {
  console.error('[API] CRITICAL: VITE_API_BASE_URL is not defined. API calls will fail.');
  // In production, we want a hard failure to avoid silent bugs, 
  // but we'll use a console error + conditional throw to be safe during hydration
  throw new Error('VITE_API_BASE_URL is missing. Please set it in your environment variables.');
}

const API = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor (currently unused as we moved to secure cookies, but kept for logging/extensibility)
API.interceptors.request.use(
  (config) => {
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
