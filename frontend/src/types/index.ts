// User Types
export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  packageId?: number;
  package?: Package;
  phone?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface Role {
  id: number;
  name: string;
  permissions: Record<string, string[]>;
}

export type RoleName =
  | 'Super Admin'
  | 'PMC Head'
  | 'Package Manager'
  | 'Auditor'
  | 'Contractor'
  | 'Viewer';

// Package Types
export interface Package {
  id: number;
  code: string;
  name: string;
  location?: string;
  description?: string;
  contractorName?: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

// Audit Master Data Types
export interface AuditCategory {
  id: number;
  code: string;
  name: string;
  fullTitle?: string;
  description?: string;
  type: CategoryType;
  applicableStandards?: string;
  displayOrder: number;
  isActive: boolean;
  itemCount?: number;
  sections?: AuditSection[];
}

export type CategoryType =
  | 'Compliance'
  | 'System'
  | 'Process'
  | 'Technical'
  | 'KPI'
  | 'Assessment'
  | 'Oversight';

export interface AuditSection {
  id: number;
  categoryId: number;
  code: string;
  name: string;
  displayOrder: number;
  items?: AuditItem[];
}

export interface AuditItem {
  id: number;
  sectionId: number;
  srNo: number;
  auditPoint: string;
  standardReference?: string;
  evidenceRequired?: string;
  priority: 'P1' | 'P2';
  isActive: boolean;
}

// Audit Types
export interface Audit {
  id: number;
  auditNumber: string;
  packageId: number;
  package?: Package;
  auditType: AuditType;
  auditorId: number;
  auditor?: User;
  reviewerId?: number;
  reviewer?: User;
  contractorRep?: string;
  scheduledDate?: string;
  auditDate?: string;
  status: AuditStatus;
  totalItems: number;
  compliantCount: number;
  nonCompliantCount: number;
  naCount: number;
  nvCount: number;
  compliancePercentage?: number;
  categories?: AuditCategory[];
  createdAt: string;
  completedAt?: string;
  approvedAt?: string;
  approvedBy?: number;
}

export type AuditType = 'Full' | 'Partial' | 'Focused';

export type AuditStatus =
  | 'Draft'
  | 'In Progress'
  | 'Pending Review'
  | 'Approved'
  | 'Closed'
  | 'On Hold'
  | 'Rejected';

// Audit Response Types
export interface AuditResponse {
  id: number;
  auditId: number;
  auditItemId: number;
  auditItem?: AuditItem;
  status: ResponseStatus;
  observation?: string;
  riskRating?: RiskRating;
  capaRequired: boolean;
  remarks?: string;
  evidences?: AuditEvidence[];
  createdAt: string;
  updatedAt: string;
  updatedBy?: number;
}

export type ResponseStatus = 'C' | 'NC' | 'NA' | 'NV';

export type RiskRating = 'Critical' | 'Major' | 'Minor' | 'Observation';

export interface AuditEvidence {
  id: number;
  responseId: number;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedBy: number;
  uploadedAt: string;
}

// CAPA Types
export interface CAPA {
  id: number;
  capaNumber: string;
  responseId: number;
  response?: AuditResponse;
  audit?: Audit;
  findingDescription: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  responsiblePerson?: string;
  responsibleDept?: string;
  targetDate?: string;
  status: CAPAStatus;
  closedDate?: string;
  verifiedBy?: number;
  verificationRemarks?: string;
  createdAt: string;
}

export type CAPAStatus = 'Open' | 'In Progress' | 'Pending Verification' | 'Closed';

// KPI Types
export interface KPIIndicator {
  id: number;
  type: 'Leading' | 'Lagging';
  category?: string;
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
  package?: Package;
  indicatorId: number;
  indicator?: KPIIndicator;
  periodMonth: number;
  periodYear: number;
  targetValue?: number;
  actualValue?: number;
  manHoursWorked?: number;
  incidentsCount?: number;
  remarks?: string;
  enteredBy?: number;
  createdAt: string;
}

// Maturity Assessment Types
export interface MaturityAssessment {
  id: number;
  packageId: number;
  package?: Package;
  assessmentDate: string;
  assessorId: number;
  assessor?: User;
  overallScore?: number;
  status: string;
  responses?: MaturityResponse[];
  createdAt: string;
}

export interface MaturityResponse {
  id: number;
  assessmentId: number;
  dimension: string;
  question: string;
  score?: number;
  evidence?: string;
  gapIdentified?: string;
  recommendations?: string;
}

// Dashboard Types
export interface DashboardStats {
  overallCompliance: number;
  openNCs: number;
  capaOverdue: number;
  daysWithoutLTI: number;
  complianceChange: number;
  ncChange: number;
}

export interface PackageCompliance {
  packageId: number;
  packageCode: string;
  packageName: string;
  compliancePercentage: number;
}

export interface ComplianceTrend {
  month: string;
  compliance: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Form Types
export interface CreateAuditForm {
  packageId: number;
  auditType: AuditType;
  categoryIds: number[];
  scheduledDate: string;
  contractorRep?: string;
}

export interface AuditResponseForm {
  auditItemId: number;
  status: ResponseStatus;
  observation?: string;
  riskRating?: RiskRating;
  capaRequired: boolean;
  remarks?: string;
}

export interface LoginForm {
  email: string;
  password: string;
}
