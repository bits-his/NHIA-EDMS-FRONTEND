import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { useAuthStore as useAuthStoreRaw } from '@/stores/authStore';

/**
 * All `*_Client` instances target backend agents (REST JSON). Base URLs come from
 * `import.meta.env.VITE_*_URL`: either absolute (`http://localhost:3002`) when
 * `CORS_ORIGIN` is set on backends, or same-origin paths (`/proxy/document`) where
 * the Vite dev server proxies to those ports — same backend routes either way.
 *
 * Document agent URLs in `documentsApi` always include the `/documents/...` prefix.
 * If `VITE_DOCUMENT_URL` mistakenly ends with `/documents`, path joins can duplicate
 * segments — strip a trailing `/documents` suffix from the base URL.
 */
function normalizeDocumentAgentBaseUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, '');
  u = u.replace(/\/documents$/i, '');
  return u;
}

const URLS = {
  orchestrator: import.meta.env.VITE_ORCHESTRATOR_URL ?? 'http://localhost:3000',
  auth: import.meta.env.VITE_AUTH_URL ?? 'http://localhost:3001',
  document: normalizeDocumentAgentBaseUrl(import.meta.env.VITE_DOCUMENT_URL ?? 'http://localhost:3012'),
  workflow: import.meta.env.VITE_WORKFLOW_URL ?? 'http://localhost:3003',
  task: import.meta.env.VITE_TASK_URL ?? 'http://localhost:3004',
  audit: import.meta.env.VITE_AUDIT_URL ?? 'http://localhost:3005',
  notification: import.meta.env.VITE_NOTIFICATION_URL ?? 'http://localhost:3006',
  searchOcr: import.meta.env.VITE_SEARCH_OCR_URL ?? 'http://localhost:3007',
};

function createClient(baseURL: string): AxiosInstance {
  const instance = axios.create({ baseURL, timeout: 30_000 });

  // Inject JWT on every request
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('nhia_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Normalize error responses
  instance.interceptors.response.use(
    (res) => res,
    (error) => {
      if (error.response?.status === 401) {
        // Token expired — clear persisted auth state.
        // The React Router guards will redirect to /login on next render.
        // We avoid window.location.href to prevent a hard reload race condition.
        const { clearAuth } = useAuthStoreRaw.getState();
        clearAuth();
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

export const orchestratorClient = createClient(URLS.orchestrator);
export const authClient = createClient(URLS.auth);
export const documentClient = createClient(URLS.document);
export const workflowClient = createClient(URLS.workflow);
export const taskClient = createClient(URLS.task);
export const auditClient = createClient(URLS.audit);
export const notificationClient = createClient(URLS.notification);
export const searchOcrClient = createClient(URLS.searchOcr);

// Helper to extract error message from backend error shape
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data?.detail) return data.detail;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

export type { AxiosRequestConfig };
