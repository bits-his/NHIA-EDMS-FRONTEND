/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORCHESTRATOR_URL: string;
  readonly VITE_AUTH_URL: string;
  readonly VITE_DOCUMENT_URL: string;
  readonly VITE_WORKFLOW_URL: string;
  readonly VITE_TASK_URL: string;
  readonly VITE_AUDIT_URL: string;
  readonly VITE_NOTIFICATION_URL: string;
  readonly VITE_SEARCH_OCR_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
