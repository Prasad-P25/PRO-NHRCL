import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { toast } from '@/hooks/use-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple redirects
let isRedirecting = false;

// Request interceptor to add auth token and project ID
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
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
    // Don't show toast for 401 on login page or when already redirecting
    const isLoginRequest = error.config?.url?.includes('/auth/login');

    if (error.response?.status === 401 && !isRedirecting && !isLoginRequest) {
      isRedirecting = true;
      toast({
        title: 'Session Expired',
        description: 'Please login again to continue.',
        variant: 'destructive',
      });
      // Clear storage directly to ensure it's cleared before redirect
      localStorage.removeItem('auth-storage');
      useAuthStore.getState().logout();
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
    } else if (!isLoginRequest && error.response?.status !== 401) {
      // Show toast for other errors (not login failures)
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
