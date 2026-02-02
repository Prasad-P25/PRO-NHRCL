import api from './api';
import type {
  Audit,
  AuditCategory,
  AuditResponse,
  AuditResponseForm,
  CreateAuditForm,
  ApiResponse,
  PaginatedResponse,
  Package,
} from '@/types';

export const auditService = {
  // Packages
  getPackages: async (): Promise<ApiResponse<Package[]>> => {
    const response = await api.get<ApiResponse<Package[]>>('/packages');
    return response.data;
  },

  getPackage: async (id: number): Promise<ApiResponse<Package>> => {
    const response = await api.get<ApiResponse<Package>>(`/packages/${id}`);
    return response.data;
  },

  // Categories
  getCategories: async (includeSections?: boolean): Promise<ApiResponse<AuditCategory[]>> => {
    const params = includeSections ? { includeSections: 'true' } : {};
    const response = await api.get<ApiResponse<AuditCategory[]>>('/audit-categories', { params });
    return response.data;
  },

  getCategory: async (id: number): Promise<ApiResponse<AuditCategory>> => {
    const response = await api.get<ApiResponse<AuditCategory>>(`/audit-categories/${id}`);
    return response.data;
  },

  // Audits
  getAudits: async (params?: {
    page?: number;
    pageSize?: number;
    packageId?: number;
    status?: string;
    auditorId?: number;
  }): Promise<PaginatedResponse<Audit>> => {
    const response = await api.get<PaginatedResponse<Audit>>('/audits', { params });
    return response.data;
  },

  getAudit: async (id: number): Promise<ApiResponse<Audit>> => {
    const response = await api.get<ApiResponse<Audit>>(`/audits/${id}`);
    return response.data;
  },

  createAudit: async (data: CreateAuditForm): Promise<ApiResponse<Audit>> => {
    const response = await api.post<ApiResponse<Audit>>('/audits', data);
    return response.data;
  },

  updateAudit: async (id: number, data: Partial<Audit>): Promise<ApiResponse<Audit>> => {
    const response = await api.put<ApiResponse<Audit>>(`/audits/${id}`, data);
    return response.data;
  },

  deleteAudit: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.delete<ApiResponse<{ message: string }>>(`/audits/${id}`);
    return response.data;
  },

  submitAudit: async (id: number): Promise<ApiResponse<Audit>> => {
    const response = await api.post<ApiResponse<Audit>>(`/audits/${id}/submit`);
    return response.data;
  },

  approveAudit: async (id: number, comments?: string): Promise<ApiResponse<Audit>> => {
    const response = await api.post<ApiResponse<Audit>>(`/audits/${id}/approve`, { comments });
    return response.data;
  },

  rejectAudit: async (id: number, reason: string): Promise<ApiResponse<Audit>> => {
    const response = await api.post<ApiResponse<Audit>>(`/audits/${id}/reject`, { reason });
    return response.data;
  },

  // Audit Responses
  getAuditResponses: async (auditId: number): Promise<ApiResponse<AuditResponse[]>> => {
    const response = await api.get<ApiResponse<AuditResponse[]>>(`/audits/${auditId}/responses`);
    return response.data;
  },

  saveAuditResponses: async (
    auditId: number,
    responses: AuditResponseForm[]
  ): Promise<ApiResponse<{ savedCount: number }>> => {
    const response = await api.post<ApiResponse<{ savedCount: number }>>(
      `/audits/${auditId}/responses`,
      { responses }
    );
    return response.data;
  },

  updateAuditResponse: async (
    responseId: number,
    data: Partial<AuditResponseForm>
  ): Promise<ApiResponse<AuditResponse>> => {
    const response = await api.put<ApiResponse<AuditResponse>>(`/audits/responses/${responseId}`, data);
    return response.data;
  },

  // Evidence
  uploadEvidence: async (responseId: number, file: File): Promise<ApiResponse<{ fileId: number; filePath: string }>> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<ApiResponse<{ fileId: number; filePath: string }>>(
      `/audits/responses/${responseId}/evidence`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  deleteEvidence: async (responseId: number, evidenceId: number): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.delete<ApiResponse<{ message: string }>>(
      `/audits/responses/${responseId}/evidence/${evidenceId}`
    );
    return response.data;
  },

  // Export audit to Word document
  exportToWord: async (auditId: number): Promise<void> => {
    try {
      const response = await api.get(`/audits/${auditId}/export-word`, {
        responseType: 'blob',
      });

      // Check if we got a valid response
      if (!response.data || response.data.size === 0) {
        throw new Error('Empty response received');
      }

      // Create download link
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `audit-${auditId}-report.docx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  },
};
