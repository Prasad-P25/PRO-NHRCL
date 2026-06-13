import api from './api';
import type { ApiResponse } from '@/types';

export interface KPIIndicator {
  id: number;
  type: 'Leading' | 'Lagging';
  category: string;
  name: string;
  definition?: string;
  formula?: string;
  unit?: string;
  benchmarkValue?: number;
  displayOrder: number;
}

export interface KPIEntry {
  id: number;
  packageId: number;
  package: {
    id: number;
    code: string;
    name: string;
  };
  indicatorId: number;
  indicator: {
    id: number;
    name: string;
    type: string;
    unit?: string;
    benchmarkValue?: number;
  };
  periodMonth: number;
  periodYear: number;
  targetValue?: number;
  actualValue?: number;
  manHoursWorked?: number;
  incidentsCount?: number;
  remarks?: string;
  createdAt: string;
}

export interface CreateKPIEntryForm {
  packageId: number;
  indicatorId: number;
  periodMonth: number;
  periodYear: number;
  targetValue?: number;
  actualValue?: number;
  manHoursWorked?: number;
  incidentsCount?: number;
  remarks?: string;
}

export interface UpdateKPIEntryForm {
  targetValue?: number;
  actualValue?: number;
  manHoursWorked?: number;
  incidentsCount?: number;
  remarks?: string;
}

export interface KPISummary {
  indicatorId: number;
  name: string;
  type: 'Leading' | 'Lagging';
  unit?: string;
  targetValue: number;
  actualValue: number;
  benchmarkValue?: number;
  invertColors?: boolean; // For metrics where lower is better
}

export interface OverallKPI {
  score: number | null;
  kpisWithData: number;
  totalKPIs: number;
  status: 'No Data' | 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement';
}

export interface KPISummaryResponse {
  data: KPISummary[];
  overallKPI: OverallKPI;
}

export const kpiService = {
  getIndicators: async (type?: 'Leading' | 'Lagging'): Promise<ApiResponse<KPIIndicator[]>> => {
    const params = type ? { type } : {};
    const response = await api.get<ApiResponse<KPIIndicator[]>>('/kpi/indicators', { params });
    return response.data;
  },

  getEntries: async (params?: {
    packageId?: number;
    indicatorId?: number;
    periodMonth?: number;
    periodYear?: number;
  }): Promise<ApiResponse<KPIEntry[]>> => {
    const response = await api.get<ApiResponse<KPIEntry[]>>('/kpi/entries', { params });
    return response.data;
  },

  createEntry: async (data: CreateKPIEntryForm): Promise<ApiResponse<KPIEntry>> => {
    const response = await api.post<ApiResponse<KPIEntry>>('/kpi/entries', data);
    return response.data;
  },

  updateEntry: async (id: number, data: UpdateKPIEntryForm): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.put<ApiResponse<{ message: string }>>(`/kpi/entries/${id}`, data);
    return response.data;
  },

  // Bulk save entries for a package/period. Uses allSettled so one bad row does
  // not discard the others; reports which indicators failed.
  saveEntries: async (
    entries: CreateKPIEntryForm[]
  ): Promise<ApiResponse<{ savedCount: number; failed: { indicatorId: number; message: string }[] }>> => {
    const results = await Promise.allSettled(
      entries.map((entry) => api.post<ApiResponse<KPIEntry>>('/kpi/entries', entry))
    );

    const failed: { indicatorId: number; message: string }[] = [];
    let savedCount = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        savedCount += 1;
      } else {
        const err: any = result.reason;
        failed.push({
          indicatorId: entries[index].indicatorId,
          message: err?.response?.data?.message || 'Failed to save',
        });
      }
    });

    return {
      success: failed.length === 0,
      data: { savedCount, failed },
    };
  },

  // Get KPI summary for dashboard gauges (latest period)
  getSummary: async (): Promise<ApiResponse<KPISummary[]> & { overallKPI?: OverallKPI }> => {
    const response = await api.get<ApiResponse<KPISummary[]> & { overallKPI?: OverallKPI }>('/kpi/summary');
    return response.data;
  },
};
