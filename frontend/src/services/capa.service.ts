import api from './api';
import type { ApiResponse, PaginatedResponse } from '@/types';

export interface CAPA {
  id: number;
  capaNumber: string;
  responseId: number;
  auditNumber: string;
  packageCode: string;
  packageName: string;
  auditPoint: string;
  standardReference?: string;
  findingDescription: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  responsiblePerson?: string;
  responsibleDept?: string;
  targetDate?: string;
  status: 'Open' | 'In Progress' | 'Closed';
  closedDate?: string;
  verifiedBy?: number;
  verifierName?: string;
  verificationRemarks?: string;
  createdAt: string;
}

export interface CreateCAPAForm {
  responseId: number;
  findingDescription: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  responsiblePerson?: string;
  responsibleDept?: string;
  targetDate?: string;
}

export interface UpdateCAPAForm {
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  responsiblePerson?: string;
  responsibleDept?: string;
  targetDate?: string;
  status?: 'Open' | 'In Progress' | 'Closed';
}

export const capaService = {
  getAll: async (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    packageId?: number;
  }): Promise<PaginatedResponse<CAPA>> => {
    const response = await api.get<PaginatedResponse<CAPA>>('/capa', { params });
    return response.data;
  },

  getById: async (id: number): Promise<ApiResponse<CAPA>> => {
    const response = await api.get<ApiResponse<CAPA>>(`/capa/${id}`);
    return response.data;
  },

  create: async (data: CreateCAPAForm): Promise<ApiResponse<CAPA>> => {
    const response = await api.post<ApiResponse<CAPA>>('/capa', data);
    return response.data;
  },

  update: async (id: number, data: UpdateCAPAForm): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.put<ApiResponse<{ message: string }>>(`/capa/${id}`, data);
    return response.data;
  },

  close: async (id: number, verificationRemarks?: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.post<ApiResponse<{ message: string }>>(`/capa/${id}/close`, {
      verificationRemarks,
    });
    return response.data;
  },
};
