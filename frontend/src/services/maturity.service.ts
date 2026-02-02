import api from './api';
import type { ApiResponse, MaturityAssessment, MaturityResponse } from '@/types';

// Extended types for maturity
export interface MaturityAssessmentWithDetails extends MaturityAssessment {
  packageCode: string;
  packageName: string;
  assessorName: string;
}

export interface MaturityQuestion {
  id: string;
  question: string;
}

export interface MaturityDimension {
  name: string;
  questions: MaturityQuestion[];
}

export interface MaturityModel {
  dimensions: MaturityDimension[];
  scoringCriteria: Record<number, string>;
}

export interface DimensionSummary {
  dimension: string;
  avgScore: string | null;
  questionCount: number;
  answeredCount: number;
}

export interface MaturityResponseUpdate {
  id: number;
  score?: number;
  evidence?: string;
  gapIdentified?: string;
  recommendations?: string;
}

export const maturityService = {
  // Get maturity model structure
  getModel: async (): Promise<ApiResponse<MaturityModel>> => {
    const response = await api.get<ApiResponse<MaturityModel>>('/maturity/model');
    return response.data;
  },

  // Get all assessments
  getAll: async (params?: {
    packageId?: number;
    status?: string;
  }): Promise<ApiResponse<MaturityAssessmentWithDetails[]>> => {
    const response = await api.get<ApiResponse<MaturityAssessmentWithDetails[]>>('/maturity', {
      params,
    });
    return response.data;
  },

  // Get single assessment with responses
  getById: async (
    id: number
  ): Promise<ApiResponse<MaturityAssessmentWithDetails & { responses: MaturityResponse[] }>> => {
    const response = await api.get<
      ApiResponse<MaturityAssessmentWithDetails & { responses: MaturityResponse[] }>
    >(`/maturity/${id}`);
    return response.data;
  },

  // Get dimension summary for an assessment
  getDimensionSummary: async (id: number): Promise<ApiResponse<DimensionSummary[]>> => {
    const response = await api.get<ApiResponse<DimensionSummary[]>>(`/maturity/${id}/summary`);
    return response.data;
  },

  // Create new assessment
  create: async (data: {
    packageId: number;
    assessmentDate?: string;
  }): Promise<ApiResponse<{ id: number }>> => {
    const response = await api.post<ApiResponse<{ id: number }>>('/maturity', data);
    return response.data;
  },

  // Update responses
  updateResponses: async (
    id: number,
    responses: MaturityResponseUpdate[]
  ): Promise<ApiResponse<{ overallScore: string | null }>> => {
    const response = await api.put<ApiResponse<{ overallScore: string | null }>>(
      `/maturity/${id}/responses`,
      { responses }
    );
    return response.data;
  },

  // Submit assessment
  submit: async (id: number): Promise<ApiResponse<void>> => {
    const response = await api.post<ApiResponse<void>>(`/maturity/${id}/submit`);
    return response.data;
  },

  // Delete assessment
  delete: async (id: number): Promise<ApiResponse<void>> => {
    const response = await api.delete<ApiResponse<void>>(`/maturity/${id}`);
    return response.data;
  },
};

export default maturityService;
