import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';
import { AuditListPage } from '@/pages/AuditList';
import { NewAuditPage } from '@/pages/NewAudit';
import { AuditExecutionPage } from '@/pages/AuditExecution';
import { CAPAListPage } from '@/pages/CAPAList';
import { KPIEntryPage } from '@/pages/KPIEntry';
import { KPIDashboardPage } from '@/pages/KPIDashboard';
import { ReportsPage } from '@/pages/Reports';
import { MaturityListPage } from '@/pages/MaturityList';
import { MaturityAssessmentPage } from '@/pages/MaturityAssessment';
import { UserManagementPage } from '@/pages/UserManagement';
import { RoleManagementPage } from '@/pages/RoleManagement';
import { ChecklistManagementPage } from '@/pages/ChecklistManagement';
import { ProfilePage } from '@/pages/Profile';
import { ProjectListPage } from '@/pages/ProjectList';
import { ProjectCreatePage } from '@/pages/ProjectCreate';
import { ProjectSettingsPage } from '@/pages/ProjectSettings';
import { ProjectDashboardPage } from '@/pages/ProjectDashboard';
import { CAPAAnalyticsPage } from '@/pages/CAPAAnalytics';
import { useAuthStore } from '@/store/authStore';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
        }
      />

      {/* Protected routes */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<DashboardPage />} />

        {/* Audit routes */}
        <Route path="/audits" element={<AuditListPage />} />
        <Route path="/audits/new" element={<NewAuditPage />} />
        <Route path="/audits/my" element={<AuditListPage />} />
        <Route path="/audits/pending" element={<AuditListPage />} />
        <Route path="/audits/:id" element={<AuditExecutionPage />} />
        <Route path="/audits/:id/execute" element={<AuditExecutionPage />} />

        {/* KPI routes */}
        <Route path="/kpi" element={<KPIDashboardPage />} />
        <Route path="/kpi/dashboard" element={<KPIDashboardPage />} />
        <Route path="/kpi/leading" element={<KPIEntryPage />} />
        <Route path="/kpi/lagging" element={<KPIEntryPage />} />
        <Route path="/kpi/entry" element={<KPIEntryPage />} />

        {/* CAPA routes */}
        <Route path="/capa" element={<CAPAListPage />} />
        <Route path="/capa/analytics" element={<CAPAAnalyticsPage />} />
        <Route path="/capa/open" element={<CAPAListPage />} />
        <Route path="/capa/my" element={<CAPAListPage />} />
        <Route path="/capa/overdue" element={<CAPAListPage />} />

        {/* Reports */}
        <Route path="/reports" element={<ReportsPage />} />

        {/* Maturity Assessment */}
        <Route path="/maturity" element={<MaturityListPage />} />
        <Route path="/maturity/new" element={<MaturityListPage />} />
        <Route path="/maturity/:id" element={<MaturityAssessmentPage />} />

        {/* Projects */}
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/projects/new" element={<ProjectCreatePage />} />
        <Route path="/projects/dashboard" element={<ProjectDashboardPage />} />
        <Route path="/projects/:id/settings" element={<ProjectSettingsPage />} />

        {/* Settings */}
        <Route path="/settings/users" element={<UserManagementPage />} />
        <Route path="/settings/roles" element={<RoleManagementPage />} />
        <Route path="/settings/checklist" element={<ChecklistManagementPage />} />

        {/* Profile */}
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
