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

// --- Client rectification portal ---
export interface CorrectionPhoto {
  id: number;
  filePath: string;
  fileName: string;
  uploadedAt?: string;
}

export type RectificationStatus = 'To Fix' | 'Submitted' | 'Approved' | 'Rejected';

export interface Correction {
  id: number;
  capaNumber: string;
  auditNumber: string;
  packageCode: string;
  packageName: string;
  auditPoint: string;
  standardReference?: string;
  findingDescription: string;
  observation?: string;
  riskRating?: string;
  targetDate?: string;
  status: 'Open' | 'In Progress' | 'Closed';
  rectificationStatus: RectificationStatus;
  reviewNote?: string;
  submittedAt?: string;
  problemPhotos: CorrectionPhoto[];
  fixPhotos: CorrectionPhoto[];
}

export const correctionService = {
  getMyCorrections: async (): Promise<ApiResponse<Correction[]>> => {
    const response = await api.get<ApiResponse<Correction[]>>('/capa/my-corrections');
    return response.data;
  },

  getReviewQueue: async (): Promise<ApiResponse<Correction[]>> => {
    const response = await api.get<ApiResponse<Correction[]>>('/capa/review-queue');
    return response.data;
  },

  uploadFixPhoto: async (
    capaId: number,
    file: File
  ): Promise<ApiResponse<{ fileId: number; filePath: string }>> => {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post<ApiResponse<{ fileId: number; filePath: string }>>(
      `/capa/${capaId}/rectification-evidence`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  deleteFixPhoto: async (capaId: number, evidenceId: number): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.delete<ApiResponse<{ message: string }>>(
      `/capa/${capaId}/rectification-evidence/${evidenceId}`
    );
    return response.data;
  },

  submit: async (capaId: number): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.post<ApiResponse<{ message: string }>>(`/capa/${capaId}/submit-rectification`);
    return response.data;
  },

  review: async (
    capaId: number,
    action: 'approve' | 'reject',
    note?: string
  ): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.post<ApiResponse<{ message: string }>>(`/capa/${capaId}/review`, {
      action,
      note,
    });
    return response.data;
  },
};

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
