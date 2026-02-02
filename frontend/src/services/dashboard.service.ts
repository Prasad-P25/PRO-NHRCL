import api from './api';
import type {
  ApiResponse,
  DashboardStats,
  PackageCompliance,
  ComplianceTrend,
  Audit,
} from '@/types';

export interface NCByCategory {
  code: string;
  name: string;
  count: number;
}

export interface RecentActivity {
  type: 'audit' | 'capa';
  reference: string;
  status: string;
  packageCode: string;
  userName?: string;
  timestamp: string;
}

export interface DashboardData {
  stats: DashboardStats & {
    totalAudits?: number;
    totalCAPAs?: number;
  };
  capaStatus?: Record<string, number>;
  auditStatus?: Record<string, number>;
  packageCompliance: (PackageCompliance & {
    auditCount?: number;
    totalNCs?: number;
  })[];
  complianceTrend: (ComplianceTrend & {
    auditCount?: number;
  })[];
  ncByCategory?: NCByCategory[];
  recentAudits: Audit[];
  recentActivity?: RecentActivity[];
}

export const dashboardService = {
  getOverview: async (): Promise<ApiResponse<DashboardData>> => {
    const response = await api.get<ApiResponse<DashboardData>>('/dashboard/overview');
    return response.data;
  },

  getPackageDashboard: async (packageId: number): Promise<ApiResponse<DashboardData>> => {
    const response = await api.get<ApiResponse<DashboardData>>(`/dashboard/package/${packageId}`);
    return response.data;
  },

  getKPISummary: async (params?: {
    packageId?: number;
    periodMonth?: number;
    periodYear?: number;
  }): Promise<ApiResponse<{
    leadingIndicators: Array<{ name: string; target: number; actual: number; unit: string }>;
    laggingIndicators: Array<{ name: string; value: number; benchmark: number; unit: string }>;
  }>> => {
    const response = await api.get('/dashboard/kpi-summary', { params });
    return response.data;
  },
};
