import api from './api';
import type { Project, ApiResponse } from '@/types';

export interface CreateProjectData {
  code: string;
  name: string;
  description?: string;
  clientName?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  clientName?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  status?: 'Active' | 'Inactive' | 'Completed';
  settings?: Record<string, any>;
}

export interface ProjectUser {
  id: number;
  userId: number;
  email: string;
  name: string;
  phone?: string;
  isActive: boolean;
  roleName: string;
  isDefault: boolean;
  assignedAt: string;
}

const projectService = {
  /**
   * Get all projects accessible to the current user
   */
  async getUserProjects(): Promise<Project[]> {
    const response = await api.get<ApiResponse<Project[]>>('/projects');
    return response.data.data;
  },

  /**
   * Get a single project by ID
   */
  async getProject(id: number): Promise<Project> {
    const response = await api.get<ApiResponse<Project>>(`/projects/${id}`);
    return response.data.data;
  },

  /**
   * Create a new project (Super Admin only)
   */
  async createProject(data: CreateProjectData): Promise<Project> {
    const response = await api.post<ApiResponse<Project>>('/projects', data);
    return response.data.data;
  },

  /**
   * Update a project
   */
  async updateProject(id: number, data: UpdateProjectData): Promise<void> {
    await api.put(`/projects/${id}`, data);
  },

  /**
   * Delete a project (soft delete)
   */
  async deleteProject(id: number): Promise<void> {
    await api.delete(`/projects/${id}`);
  },

  /**
   * Get users assigned to a project
   */
  async getProjectUsers(projectId: number): Promise<ProjectUser[]> {
    const response = await api.get<ApiResponse<ProjectUser[]>>(`/projects/${projectId}/users`);
    return response.data.data;
  },

  /**
   * Assign a user to a project
   */
  async assignUser(projectId: number, userId: number, isDefault: boolean = false): Promise<void> {
    await api.post(`/projects/${projectId}/users`, { userId, isDefault });
  },

  /**
   * Remove a user from a project
   */
  async removeUser(projectId: number, userId: number): Promise<void> {
    await api.delete(`/projects/${projectId}/users/${userId}`);
  },

  /**
   * Set a project as the default for a user
   */
  async setDefaultProject(projectId: number, userId?: number): Promise<void> {
    await api.post(`/projects/${projectId}/set-default`, userId ? { userId } : {});
  },
};

export default projectService;
