import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { LoginPage } from '@/pages/Login';
import { ResetPasswordPage } from '@/pages/ResetPassword';
import { DashboardPage } from '@/pages/Dashboard';
import { AuditListPage } from '@/pages/AuditList';
import { NewAuditPage } from '@/pages/NewAudit';
import { AuditExecutionPage } from '@/pages/AuditExecution';
import { CAPAListPage } from '@/pages/CAPAList';
import { ClientCorrectionsPage } from '@/pages/ClientCorrections';
import { RectificationReviewPage } from '@/pages/RectificationReview';
import { ReportsPage } from '@/pages/Reports';
import { UserManagementPage } from '@/pages/UserManagement';
import { RoleManagementPage } from '@/pages/RoleManagement';
import { ChecklistManagementPage } from '@/pages/ChecklistManagement';
import { ProfilePage } from '@/pages/Profile';
import { ProjectListPage } from '@/pages/ProjectList';
import { ProjectCreatePage } from '@/pages/ProjectCreate';
import { ProjectSettingsPage } from '@/pages/ProjectSettings';
import { CAPAAnalyticsPage } from '@/pages/CAPAAnalytics';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { useAuthStore } from '@/store/authStore';

// Home ("/") depends on role: Clients get their fix list, everyone else the dashboard.
function HomeRoute() {
  const { user } = useAuthStore();
  const roleName = user?.role?.name || (user as any)?.roleName || '';
  if (roleName === 'Client') {
    return <Navigate to="/my-corrections" replace />;
  }
  return <DashboardPage />;
}

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
      {/* Password reset from the email link — public (user is logged out) */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected routes */}
      <Route element={<MainLayout />}>
        {/* Clients have no dashboard — send them straight to their fix list */}
        <Route path="/" element={<HomeRoute />} />

        {/* Client rectification portal (Client role only) */}
        <Route
          path="/my-corrections"
          element={<RoleGuard roles={['Client']}><ClientCorrectionsPage /></RoleGuard>}
        />
        {/* Auditor-side review of client submissions */}
        <Route
          path="/rectifications"
          element={
            <RoleGuard roles={['Super Admin', 'PMC Head', 'Package Manager', 'Auditor']}>
              <RectificationReviewPage />
            </RoleGuard>
          }
        />

        {/* Audit routes */}
        <Route path="/audits" element={<AuditListPage />} />
        <Route path="/audits/new" element={<NewAuditPage />} />
        <Route path="/audits/my" element={<AuditListPage />} />
        <Route path="/audits/pending" element={<AuditListPage />} />
        <Route path="/audits/:id" element={<AuditExecutionPage />} />
        <Route path="/audits/:id/execute" element={<AuditExecutionPage />} />

        {/* CAPA routes */}
        <Route path="/capa" element={<CAPAListPage />} />
        <Route path="/capa/analytics" element={<CAPAAnalyticsPage />} />
        <Route path="/capa/open" element={<CAPAListPage />} />
        <Route path="/capa/my" element={<CAPAListPage />} />
        <Route path="/capa/overdue" element={<CAPAListPage />} />

        {/* Reports */}
        <Route path="/reports" element={<ReportsPage />} />

        {/* Projects (Super Admin only) */}
        <Route path="/projects" element={<RoleGuard roles={['Super Admin']}><ProjectListPage /></RoleGuard>} />
        <Route path="/projects/new" element={<RoleGuard roles={['Super Admin']}><ProjectCreatePage /></RoleGuard>} />
        <Route path="/projects/:id/settings" element={<RoleGuard roles={['Super Admin']}><ProjectSettingsPage /></RoleGuard>} />

        {/* Settings (Super Admin only) */}
        <Route path="/settings/users" element={<RoleGuard roles={['Super Admin']}><UserManagementPage /></RoleGuard>} />
        <Route path="/settings/roles" element={<RoleGuard roles={['Super Admin']}><RoleManagementPage /></RoleGuard>} />
        <Route path="/settings/checklist" element={<RoleGuard roles={['Super Admin']}><ChecklistManagementPage /></RoleGuard>} />

        {/* Profile */}
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
