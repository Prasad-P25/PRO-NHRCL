import { QueryClient } from '@tanstack/react-query';

// Single shared QueryClient instance so non-React code (auth store, api
// interceptors) can clear the cache on logout/session-expiry.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});
