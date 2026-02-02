import api from './api';
import type { ApiResponse } from '@/types';

export interface ScheduledReport {
  id: number;
  name: string;
  reportType: string;
  format: 'pdf' | 'excel';
  filters: Record<string, any>;
  scheduleType: 'daily' | 'weekly' | 'monthly';
  scheduleDay: number | null;
  scheduleTime: string;
  recipients: string[];
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdBy: number;
  creatorName?: string;
  createdAt: string;
}

export interface GeneratedReport {
  id: number;
  scheduledReportId: number | null;
  scheduleName: string | null;
  name: string;
  reportType: string;
  format: string;
  filters: Record<string, any>;
  filePath: string | null;
  fileSize: number | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage: string | null;
  generatedBy: number;
  generatorName: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateScheduledReportData {
  name: string;
  reportType: string;
  format?: 'pdf' | 'excel';
  filters?: Record<string, any>;
  scheduleType: 'daily' | 'weekly' | 'monthly';
  scheduleDay?: number;
  scheduleTime?: string;
  recipients?: string[];
  isActive?: boolean;
}

export interface GenerateReportData {
  name?: string;
  reportType: string;
  format?: 'pdf' | 'excel';
  filters?: Record<string, any>;
}

export const scheduledReportService = {
  // Get all scheduled reports
  getAll: async (): Promise<ApiResponse<ScheduledReport[]>> => {
    const response = await api.get<ApiResponse<ScheduledReport[]>>('/scheduled-reports');
    return response.data;
  },

  // Get single scheduled report
  getById: async (id: number): Promise<ApiResponse<ScheduledReport>> => {
    const response = await api.get<ApiResponse<ScheduledReport>>(`/scheduled-reports/${id}`);
    return response.data;
  },

  // Create scheduled report
  create: async (data: CreateScheduledReportData): Promise<ApiResponse<ScheduledReport>> => {
    const response = await api.post<ApiResponse<ScheduledReport>>('/scheduled-reports', data);
    return response.data;
  },

  // Update scheduled report
  update: async (id: number, data: Partial<CreateScheduledReportData>): Promise<ApiResponse<ScheduledReport>> => {
    const response = await api.put<ApiResponse<ScheduledReport>>(`/scheduled-reports/${id}`, data);
    return response.data;
  },

  // Delete scheduled report
  delete: async (id: number): Promise<ApiResponse<void>> => {
    const response = await api.delete<ApiResponse<void>>(`/scheduled-reports/${id}`);
    return response.data;
  },

  // Toggle active status
  toggleActive: async (id: number): Promise<ApiResponse<{ isActive: boolean; nextRunAt: string | null }>> => {
    const response = await api.post<ApiResponse<{ isActive: boolean; nextRunAt: string | null }>>(
      `/scheduled-reports/${id}/toggle`
    );
    return response.data;
  },

  // Run report now
  runNow: async (id: number): Promise<ApiResponse<GeneratedReport>> => {
    const response = await api.post<ApiResponse<GeneratedReport>>(`/scheduled-reports/${id}/run`);
    return response.data;
  },

  // Get generated reports history
  getHistory: async (scheduleId?: number): Promise<ApiResponse<GeneratedReport[]>> => {
    const params = scheduleId ? { scheduleId } : {};
    const response = await api.get<ApiResponse<GeneratedReport[]>>('/scheduled-reports/history', { params });
    return response.data;
  },

  // Generate on-demand report
  generateReport: async (data: GenerateReportData): Promise<ApiResponse<GeneratedReport>> => {
    const response = await api.post<ApiResponse<GeneratedReport>>('/scheduled-reports/generate', data);
    return response.data;
  },

  // Delete generated report
  deleteGenerated: async (id: number): Promise<ApiResponse<void>> => {
    const response = await api.delete<ApiResponse<void>>(`/scheduled-reports/generated/${id}`);
    return response.data;
  },
};

export default scheduledReportService;
