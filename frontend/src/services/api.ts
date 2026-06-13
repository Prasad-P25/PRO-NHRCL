import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { toast } from '@/hooks/use-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Custom per-request options
interface ExtraConfig {
  skipErrorToast?: boolean;
  skipAuthRefresh?: boolean;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple redirects
let isRedirecting = false;

// Single-flight token refresh: only one refresh request in flight at a time.
let refreshPromise: Promise<string | null> | null = null;
const REFRESH_THRESHOLD_MS = 60 * 60 * 1000; // refresh when <60 min remain

function decodeJwtExp(token: string): number | null {
  try {
    const payloadPart = token.split('.')[1];
    const json = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

async function maybeRefreshToken(token: string): Promise<string | null> {
  const exp = decodeJwtExp(token);
  if (!exp) return null;

  const msUntilExpiry = exp * 1000 - Date.now();
  // Only proactively refresh a still-valid token nearing expiry. An already
  // expired token cannot be refreshed (backend rejects it) — that path falls
  // through to the 401 handler.
  if (msUntilExpiry <= 0 || msUntilExpiry >= REFRESH_THRESHOLD_MS) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh', null, { skipAuthRefresh: true, skipErrorToast: true } as InternalAxiosRequestConfig & ExtraConfig)
      .then((res) => {
        const newToken = res.data?.data?.token as string | undefined;
        if (newToken) {
          useAuthStore.setState({ token: newToken });
          return newToken;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Request interceptor to add auth token and project ID
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig & ExtraConfig) => {
    let token = useAuthStore.getState().token;

    // Proactively refresh a near-expiry token (skip for auth endpoints and the
    // refresh call itself to avoid recursion)
    if (token && !config.skipAuthRefresh && !config.url?.includes('/auth/')) {
      const refreshed = await maybeRefreshToken(token);
      if (refreshed) token = refreshed;
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add project ID header if a project is selected
    const currentProject = useAppStore.getState().currentProject;
    if (currentProject?.id) {
      config.headers['X-Project-Id'] = currentProject.id.toString();
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Helper to get user-friendly error message
function getErrorMessage(error: AxiosError): string {
  const data = error.response?.data as { message?: string } | undefined;

  if (data?.message) {
    return data.message;
  }

  switch (error.response?.status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Session expired. Please login again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'This action conflicts with existing data.';
    case 422:
      return 'Validation failed. Please check your input.';
    case 429:
      return 'Too many requests. Please wait a moment.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'Service unavailable. Please try again later.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
}

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & ExtraConfig) | undefined;
    const isLoginRequest = config?.url?.includes('/auth/login');
    // Suppress noisy toasts for opted-out requests (e.g. background notification polling)
    const skipToast = config?.skipErrorToast || config?.url?.includes('/notifications');

    if (error.response?.status === 401 && !isRedirecting && !isLoginRequest) {
      isRedirecting = true;
      toast({
        title: 'Session Expired',
        description: 'Please login again to continue.',
        variant: 'destructive',
      });
      // Clear storage and reset state before redirect
      localStorage.removeItem('auth-storage');
      useAuthStore.getState().logout();
      // Preserve where the user was so they can return after re-login
      const current = window.location.pathname + window.location.search;
      const redirectParam = current && current !== '/login'
        ? `?redirect=${encodeURIComponent(current)}`
        : '';
      setTimeout(() => {
        window.location.href = `/login${redirectParam}`;
      }, 1000);
    } else if (!isLoginRequest && error.response?.status !== 401 && !skipToast) {
      toast({
        title: 'Error',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }

    return Promise.reject(error);
  }
);

export default api;
