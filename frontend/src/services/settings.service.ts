import api from './api';
import type { ApiResponse, PaginatedResponse, User, Package, Role, AuditCategory } from '@/types';

// User types - separate interface to avoid type conflicts with User
export interface UserWithRole {
  id: number;
  email: string;
  name: string;
  phone?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  role: {
    id: number;
    name: string;
    permissions?: Record<string, string[] | boolean>;
  };
  package?: {
    id: number;
    code: string;
    name: string;
  } | null;
}

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  roleId: number;
  packageId?: number;
  phone?: string;
}

export interface UpdateUserData {
  name?: string;
  roleId?: number;
  packageId?: number | null;
  phone?: string;
  isActive?: boolean;
}

// Role types
export interface RoleWithCount extends Role {
  userCount: number;
  createdAt: string;
}

export interface CreateRoleData {
  name: string;
  permissions: Record<string, string[] | boolean>;
}

// Checklist types
export interface SectionData {
  id?: number;
  categoryId: number;
  code: string;
  name: string;
  displayOrder?: number;
}

export interface ItemData {
  id?: number;
  sectionId: number;
  srNo: number;
  auditPoint: string;
  standardReference?: string;
  evidenceRequired?: string;
  priority?: 'P1' | 'P2';
  isActive?: boolean;
}

export const settingsService = {
  // ========== Users ==========
  getUsers: async (params?: {
    page?: number;
    pageSize?: number;
    roleId?: number;
    packageId?: number;
    search?: string;
  }): Promise<PaginatedResponse<UserWithRole>> => {
    const response = await api.get<PaginatedResponse<UserWithRole>>('/users', { params });
    return response.data;
  },

  getUserById: async (id: number): Promise<ApiResponse<UserWithRole>> => {
    const response = await api.get<ApiResponse<UserWithRole>>(`/users/${id}`);
    return response.data;
  },

  createUser: async (data: CreateUserData): Promise<ApiResponse<User>> => {
    const response = await api.post<ApiResponse<User>>('/users', data);
    return response.data;
  },

  updateUser: async (id: number, data: UpdateUserData): Promise<ApiResponse<void>> => {
    const response = await api.put<ApiResponse<void>>(`/users/${id}`, data);
    return response.data;
  },

  deleteUser: async (id: number): Promise<ApiResponse<void>> => {
    const response = await api.delete<ApiResponse<void>>(`/users/${id}`);
    return response.data;
  },

  // ========== Packages ==========
  getPackages: async (): Promise<ApiResponse<Package[]>> => {
    const response = await api.get<ApiResponse<Package[]>>('/packages');
    return response.data;
  },

  getPackageById: async (id: number): Promise<ApiResponse<Package>> => {
    const response = await api.get<ApiResponse<Package>>(`/packages/${id}`);
    return response.data;
  },

  createPackage: async (data: Partial<Package>): Promise<ApiResponse<Package>> => {
    const response = await api.post<ApiResponse<Package>>('/packages', data);
    return response.data;
  },

  updatePackage: async (id: number, data: Partial<Package>): Promise<ApiResponse<void>> => {
    const response = await api.put<ApiResponse<void>>(`/packages/${id}`, data);
    return response.data;
  },

  // ========== Roles ==========
  getRoles: async (): Promise<ApiResponse<RoleWithCount[]>> => {
    const response = await api.get<ApiResponse<RoleWithCount[]>>('/roles');
    return response.data;
  },

  getRoleById: async (id: number): Promise<ApiResponse<Role>> => {
    const response = await api.get<ApiResponse<Role>>(`/roles/${id}`);
    return response.data;
  },

  createRole: async (data: CreateRoleData): Promise<ApiResponse<Role>> => {
    const response = await api.post<ApiResponse<Role>>('/roles', data);
    return response.data;
  },

  updateRole: async (id: number, data: Partial<CreateRoleData>): Promise<ApiResponse<void>> => {
    const response = await api.put<ApiResponse<void>>(`/roles/${id}`, data);
    return response.data;
  },

  deleteRole: async (id: number): Promise<ApiResponse<void>> => {
    const response = await api.delete<ApiResponse<void>>(`/roles/${id}`);
    return response.data;
  },

  // ========== Checklist (Categories, Sections, Items) ==========
  getCategories: async (): Promise<ApiResponse<AuditCategory[]>> => {
    const response = await api.get<ApiResponse<AuditCategory[]>>('/audit-categories');
    return response.data;
  },

  getCategoryById: async (id: number): Promise<ApiResponse<AuditCategory>> => {
    const response = await api.get<ApiResponse<AuditCategory>>(`/audit-categories/${id}`);
    return response.data;
  },

  createCategory: async (data: Partial<AuditCategory>): Promise<ApiResponse<AuditCategory>> => {
    const response = await api.post<ApiResponse<AuditCategory>>('/audit-categories', data);
    return response.data;
  },

  updateCategory: async (id: number, data: Partial<AuditCategory>): Promise<ApiResponse<void>> => {
    const response = await api.put<ApiResponse<void>>(`/audit-categories/${id}`, data);
    return response.data;
  },

  createSection: async (data: SectionData): Promise<ApiResponse<any>> => {
    const response = await api.post<ApiResponse<any>>('/audit-categories/sections', data);
    return response.data;
  },

  updateSection: async (id: number, data: Partial<SectionData>): Promise<ApiResponse<void>> => {
    const response = await api.put<ApiResponse<void>>(`/audit-categories/sections/${id}`, data);
    return response.data;
  },

  deleteSection: async (id: number): Promise<ApiResponse<void>> => {
    const response = await api.delete<ApiResponse<void>>(`/audit-categories/sections/${id}`);
    return response.data;
  },

  createItem: async (data: ItemData): Promise<ApiResponse<any>> => {
    const response = await api.post<ApiResponse<any>>('/audit-categories/items', data);
    return response.data;
  },

  updateItem: async (id: number, data: Partial<ItemData>): Promise<ApiResponse<void>> => {
    const response = await api.put<ApiResponse<void>>(`/audit-categories/items/${id}`, data);
    return response.data;
  },

  deleteItem: async (id: number): Promise<ApiResponse<void>> => {
    const response = await api.delete<ApiResponse<void>>(`/audit-categories/items/${id}`);
    return response.data;
  },

  // ========== Profile ==========
  getProfile: async (): Promise<ApiResponse<UserWithRole>> => {
    const response = await api.get<ApiResponse<UserWithRole>>('/users/me');
    return response.data;
  },

  updateProfile: async (data: { name?: string; phone?: string }): Promise<ApiResponse<void>> => {
    const response = await api.put<ApiResponse<void>>('/users/me', data);
    return response.data;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<ApiResponse<void>> => {
    const response = await api.post<ApiResponse<void>>('/auth/change-password', data);
    return response.data;
  },
};

export default settingsService;
