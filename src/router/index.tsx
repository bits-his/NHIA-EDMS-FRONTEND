import { lazy, Suspense, useMemo } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ProtectedRoute, PublicRoute, RoleGuard, TemplateManagementGuard } from './guards';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/shared/PageLoader';

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const ExecutiveReportPage = lazy(() => import('@/pages/dashboard/ExecutiveReportPage'));
const PerformancePage = lazy(() => import('@/pages/performance/PerformancePage'));
const OperationalPage = lazy(() => import('@/pages/operational/OperationalPage'));
const ArchivePage = lazy(() => import('@/pages/registry/RegistryDocumentsPage'));
const ReportsPage = lazy(() =>
  import('@/pages/registry/RegistryDocumentsPage').then((m) => ({ default: m.ReportsPage }))
);
const DocumentsPage = lazy(() => import('@/pages/documents/DocumentsPage'));
const DocumentDetailPage = lazy(() => import('@/pages/documents/DocumentDetailPage'));
const CreateDocumentPage = lazy(() => import('@/pages/documents/CreateDocumentPage'));
const EditDocumentPage = lazy(() => import('@/pages/documents/EditDocumentPage'));
const TasksPage = lazy(() => import('@/pages/tasks/TasksPage'));
const TaskDetailPage = lazy(() => import('@/pages/tasks/TaskDetailPage'));
const WorkflowsPage = lazy(() => import('@/pages/workflows/WorkflowsPage'));
const WorkflowTemplateDesignPage = lazy(() => import('@/pages/workflows/WorkflowTemplateDesignPage'));
const AuditPage = lazy(() => import('@/pages/audit/AuditPage'));
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage'));
import SearchPage from '@/pages/search/SearchPage';
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const UsersPage = lazy(() => import('@/pages/admin/UsersPage'));
const TemplateListPage = lazy(() => import('@/pages/template-management/TemplateListPage'));
const CreateDocumentTemplatePage = lazy(() => import('@/pages/template-management/CreateDocumentTemplatePage'));
function Wrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

const routerConfig = [
  {
    path: '/login',
    element: (
      <PublicRoute>
        <Wrap>
          <LoginPage />
        </Wrap>
      </PublicRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <Wrap>
            <DashboardPage />
          </Wrap>
        ),
      },
      {
        path: 'dashboard/reports',
        element: (
          <Wrap>
            <ExecutiveReportPage />
          </Wrap>
        ),
      },
      {
        path: 'performance',
        element: (
          <Wrap>
            <PerformancePage />
          </Wrap>
        ),
      },
      {
        path: 'operational',
        element: (
          <Wrap>
            <OperationalPage />
          </Wrap>
        ),
      },
      {
        path: 'intelligence',
        element: <Navigate to="/reports" replace />,
      },
      {
        path: 'archive',
        element: (
          <Wrap>
            <ArchivePage />
          </Wrap>
        ),
      },
      {
        path: 'reports',
        element: (
          <Wrap>
            <ReportsPage />
          </Wrap>
        ),
      },
      {
        path: 'documents',
        element: (
          <Wrap>
            <DocumentsPage />
          </Wrap>
        ),
      },
      {
        path: 'documents/new',
        element: (
          <Wrap>
            <CreateDocumentPage />
          </Wrap>
        ),
      },
      {
        path: 'documents/:id',
        element: (
          <Wrap>
            <DocumentDetailPage />
          </Wrap>
        ),
      },
      {
        path: 'documents/:id/edit',
        element: (
          <Wrap>
            <EditDocumentPage />
          </Wrap>
        ),
      },
      {
        path: 'tasks',
        element: (
          <Wrap>
            <TasksPage />
          </Wrap>
        ),
      },
      {
        path: 'tasks/:id',
        element: (
          <Wrap>
            <TaskDetailPage />
          </Wrap>
        ),
      },
      {
        path: 'workflows',
        element: (
          <Wrap>
            <WorkflowsPage />
          </Wrap>
        ),
      },
      {
        path: 'workflows/templates/:templateId/design',
        element: (
          <Wrap>
            <WorkflowTemplateDesignPage />
          </Wrap>
        ),
      },
      {
        path: 'audit',
        element: (
          <Wrap>
            <RoleGuard
              roles={['admin', 'director', 'general_manager']}
              fallback={<Navigate to="/dashboard" replace />}
            >
              <AuditPage />
            </RoleGuard>
          </Wrap>
        ),
      },
      {
        path: 'notifications',
        element: (
          <Wrap>
            <NotificationsPage />
          </Wrap>
        ),
      },
      {
        path: 'search',
        element: (
          <Wrap>
            <SearchPage />
          </Wrap>
        ),
      },
      {
        path: 'settings',
        element: (
          <Wrap>
            <SettingsPage />
          </Wrap>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <Wrap>
            <RoleGuard roles={['admin']} fallback={<Navigate to="/dashboard" replace />}>
              <UsersPage />
            </RoleGuard>
          </Wrap>
        ),
      },
      {
        path: 'template-management',
        element: (
          <Wrap>
            <TemplateManagementGuard fallback={<Navigate to="/dashboard" replace />}>
              <TemplateListPage />
            </TemplateManagementGuard>
          </Wrap>
        ),
      },
      {
        path: 'template-management/create',
        element: (
          <Wrap>
            <TemplateManagementGuard fallback={<Navigate to="/dashboard" replace />}>
              <CreateDocumentTemplatePage />
            </TemplateManagementGuard>
          </Wrap>
        ),
      },
      {
        path: 'template-management/edit/:templateId',
        element: (
          <Wrap>
            <TemplateManagementGuard fallback={<Navigate to="/dashboard" replace />}>
              <CreateDocumentTemplatePage />
            </TemplateManagementGuard>
          </Wrap>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
];

/**
 * Wrap the data router in a component so this module exports only components.
 * That lets Vite React Fast Refresh hot-update guards / routes without invalidating
 * `router`, which would leave the live `RouterProvider` with a stale (null) context.
 */
export function AppRouter() {
  const router = useMemo(() => createBrowserRouter(routerConfig), []);
  return <RouterProvider router={router} />;
}
