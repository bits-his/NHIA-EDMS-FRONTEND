# NHIA-EDMS Frontend

Production-grade React frontend for the NHIA Electronic Document Management System.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Language | TypeScript (strict) |
| Routing | React Router v6 |
| Server State | TanStack Query v5 |
| Client State | Zustand (persisted) |
| Forms | React Hook Form + Zod |
| Styling | Tailwind CSS v3 |
| UI Primitives | Radix UI |
| HTTP | Axios (with interceptors) |
| Notifications | Sonner |
| Animations | Framer Motion |
| File Upload | react-dropzone |

## Setup

```bash
cp .env.example .env
# Edit .env to point to your backend services
npm install
npm run dev
```

## Environment Variables

```env
VITE_ORCHESTRATOR_URL=http://localhost:3000
VITE_AUTH_URL=http://localhost:3001
VITE_DOCUMENT_URL=http://localhost:3002
VITE_WORKFLOW_URL=http://localhost:3003
VITE_TASK_URL=http://localhost:3004
VITE_AUDIT_URL=http://localhost:3005
VITE_NOTIFICATION_URL=http://localhost:3006
VITE_SEARCH_OCR_URL=http://localhost:3007
```

## Features

- **Authentication** — JWT login with role/permission loading, persisted session
- **Documents** — Full lifecycle: create → submit → approve/reject → archive, version history
- **Workflows** — Template browser, instance detail with visual stepper, advance step
- **Tasks** — My tasks list, status transitions (pending → in_progress → completed/cancelled)
- **Audit Log** — Immutable timeline, query by actor or entity, expandable JSON payloads
- **Notifications** — Real-time polling, mark read/unread, badge count in sidebar
- **Search & OCR** — Full-text Elasticsearch search + drag-and-drop OCR file extraction
- **Settings** — Profile, role/permission viewer, theme toggle (light/dark/system)

## Demo Credentials

```
alice / password123  (admin)
bob   / password123  (reviewer)
charlie / password123 (submitter)
```

## Build

```bash
npm run build
```

Output goes to `dist/`.
