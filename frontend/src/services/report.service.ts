import api from './api';
import type { ApiResponse } from '@/types';

// Report filter interfaces
export interface ReportFilters {
  packageId?: number;
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  riskRating?: string;
}

// Compliance Summary types
export interface ComplianceSummaryItem {
  packageCode: string;
  packageName: string;
  totalAudits: number;
  avgCompliance: string;
  totalCompliant: number;
  totalNC: number;
  totalNA: number;
}

// NC Summary types
export interface NCSummaryItem {
  id: number;
  auditNumber: string;
  packageCode: string;
  packageName: string;
  categoryCode: string;
  categoryName: string;
  sectionName: string;
  auditPoint: string;
  standardReference: string | null;
  priority: 'P1' | 'P2';
  observation: string | null;
  riskRating: string | null;
  capaRequired: boolean;
  createdAt: string;
}

// CAPA Status types
export interface CAPAStatusData {
  statusCounts: Record<string, number>;
  overdue: number;
}

// Trend Analysis types
export interface TrendDataItem {
  month: string;
  avgCompliance: string;
  totalNCs: number;
  auditCount: number;
}

// Package Comparison types
export interface PackageComparisonItem {
  packageId: number;
  packageCode: string;
  packageName: string;
  totalAudits: number;
  avgCompliance: string;
  totalNCs: number;
  openCAPAs: number;
}

// KPI Report types
export interface KPIReportData {
  leadingIndicators: Array<{
    name: string;
    target: number;
    actual: number;
    unit: string;
  }>;
  laggingIndicators: Array<{
    name: string;
    value: number;
    benchmark: number;
    unit: string;
  }>;
}

// Export format type
export type ExportFormat = 'pdf' | 'excel' | 'csv';

export const reportService = {
  // Get compliance summary report
  getComplianceSummary: async (filters?: ReportFilters): Promise<ApiResponse<ComplianceSummaryItem[]>> => {
    const response = await api.get<ApiResponse<ComplianceSummaryItem[]>>('/reports/compliance-summary', {
      params: filters,
    });
    return response.data;
  },

  // Get NC summary report
  getNCsSummary: async (filters?: ReportFilters): Promise<ApiResponse<NCSummaryItem[]>> => {
    const response = await api.get<ApiResponse<NCSummaryItem[]>>('/reports/nc-summary', {
      params: filters,
    });
    return response.data;
  },

  // Get CAPA status report
  getCAPAStatus: async (filters?: ReportFilters): Promise<ApiResponse<CAPAStatusData>> => {
    const response = await api.get<ApiResponse<CAPAStatusData>>('/reports/capa-status', {
      params: filters,
    });
    return response.data;
  },

  // Get trend analysis report
  getTrendAnalysis: async (filters?: ReportFilters & { months?: number }): Promise<ApiResponse<TrendDataItem[]>> => {
    const response = await api.get<ApiResponse<TrendDataItem[]>>('/reports/trend-analysis', {
      params: filters,
    });
    return response.data;
  },

  // Get package comparison report
  getPackageComparison: async (): Promise<ApiResponse<PackageComparisonItem[]>> => {
    const response = await api.get<ApiResponse<PackageComparisonItem[]>>('/reports/package-comparison');
    return response.data;
  },

  // Get KPI summary (using dashboard endpoint)
  getKPISummary: async (params?: {
    packageId?: number;
    periodMonth?: number;
    periodYear?: number;
  }): Promise<ApiResponse<KPIReportData>> => {
    const response = await api.get<ApiResponse<KPIReportData>>('/dashboard/kpi-summary', { params });
    return response.data;
  },
};

export default reportService;
