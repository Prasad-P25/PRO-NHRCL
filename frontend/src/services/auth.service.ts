import api from './api';
import type { User, LoginForm, ApiResponse } from '@/types';

interface LoginResponse {
  user: User;
  token: string;
}

export const authService = {
  login: async (credentials: LoginForm): Promise<ApiResponse<LoginResponse>> => {
    const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  refreshToken: async (): Promise<ApiResponse<{ token: string }>> => {
    const response = await api.post<ApiResponse<{ token: string }>>('/auth/refresh');
    return response.data;
  },

  getProfile: async (): Promise<ApiResponse<User>> => {
    const response = await api.get<ApiResponse<User>>('/users/me');
    return response.data;
  },

  forgotPassword: async (email: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, password: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.post<ApiResponse<{ message: string }>>('/auth/reset-password', { token, password });
    return response.data;
  },
};
