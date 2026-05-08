import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicRoute } from './guards';
import { AppShell } from '@/components/layout/AppShell';
import { PageLoader } from '@/components/shared/PageLoader';

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const DocumentsPage = lazy(() => import('@/pages/documents/DocumentsPage'));
const DocumentDetailPage = lazy(() => import('@/pages/documents/DocumentDetailPage'));
const CreateDocumentPage = lazy(() => import('@/pages/documents/CreateDocumentPage'));
const EditDocumentPage = lazy(() => import('@/pages/documents/EditDocumentPage'));
const WorkflowsPage = lazy(() => import('@/pages/workflows/WorkflowsPage'));
const WorkflowDetailPage = lazy(() => import('@/pages/workflows/WorkflowDetailPage'));
const TasksPage = lazy(() => import('@/pages/tasks/TasksPage'));
const TaskDetailPage = lazy(() => import('@/pages/tasks/TaskDetailPage'));
const AuditPage = lazy(() => import('@/pages/audit/AuditPage'));
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage'));
const SearchPage = lazy(() => import('@/pages/search/SearchPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const UsersPage = lazy(() => import('@/pages/admin/UsersPage'));

function Wrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
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
        path: 'workflows',
        element: (
          <Wrap>
            <WorkflowsPage />
          </Wrap>
        ),
      },
      {
        path: 'workflows/:id',
        element: (
          <Wrap>
            <WorkflowDetailPage />
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
        path: 'audit',
        element: (
          <Wrap>
            <AuditPage />
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
            <UsersPage />
          </Wrap>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
]);
