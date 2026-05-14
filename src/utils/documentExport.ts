import { format, parseISO } from 'date-fns';
import { NHIA_LOGO_SRC } from '@/constants/brandAssets';
import type {
  Document,
  DocumentAttachment,
  DocumentRecipient,
  DocumentVersion,
  DocumentWorkflowAction,
} from '@/types/document';
/**
 * Build a printable, self-contained HTML document for the in-tab "Export" view.
 *
 * The export embeds the full document body, comments / activity timeline,
 * recipients, attachments, and version history so a user can print or save
 * the entire case file as a single PDF from their browser.
 *
 * When `letterheadHtml` is provided (server-rendered NHIA letterhead for
 * internal memos), the additional sections are injected before `</body>` so
 * the official banner stays at the top of the page.
 */
export interface DocumentExportInput {
  doc: Document;
  /** Optional server-rendered HTML (e.g. NHIA letterhead). When provided it is used as the page shell. */
  letterheadHtml?: string | null;
  recipients?: DocumentRecipient[];
  attachments?: DocumentAttachment[];
  actions?: DocumentWorkflowAction[];
  versions?: DocumentVersion[];
  ownerName?: string | null;
  /** Lookup so we can render usernames for recipients/uploaders if their user_id is the only handle. */
  usernameFor?: (userId: string | null | undefined) => string;
}

const DELIVERY_LABEL: Record<string, string> = {
  workflow: 'Workflow',
  direct_message: 'Direct message',
};

const CATEGORY_LABEL: Record<string, string> = {
  internal_memo: 'Internal memo',
  external_correspondence: 'External correspondence',
};

const RECIPIENT_TYPE_LABEL: Record<string, string> = {
  to: 'To',
  cc: 'CC',
  bcc: 'BCC',
};

const URGENCY_LABEL: Record<string, string> = {
  normal: 'Normal',
  urgent: 'Urgent',
  very_urgent: 'Very urgent',
};

const CLASSIFICATION_LABEL: Record<string, string> = {
  normal: 'Normal',
  important: 'Important',
  secret: 'Secret',
  top_secret: 'Top secret',
};

const ACTION_LABEL: Record<string, string> = {
  reject: 'Rejected',
  edit_forward: 'Note',
  approve_forward: 'Approved & forwarded',
  request_info: 'Requested information',
  final_approve: 'Final approval',
  final_approval: 'Final approval',
  attach_send: 'Attach & send',
  review_send: 'Review & send',
  approve_send: 'Approve & send',
};

const HTML_ESCAPE_RE = /[&<>"']/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: unknown): string {
  if (value == null) return '';
  return String(value).replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

function safeFormatDate(value: string | null | undefined, pattern = 'PPpp'): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), pattern);
  } catch {
    return value;
  }
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function actorTitle(a: DocumentWorkflowAction): string {
  return (
    a.actor_rank?.trim() ||
    a.actor_role_description?.trim() ||
    a.actor_role_name?.trim().replace(/_/g, ' ') ||
    ''
  );
}

function actorName(
  a: DocumentWorkflowAction,
  usernameFor?: (id: string | null | undefined) => string
): string {
  return (
    a.actor_full_name?.trim() ||
    a.actor_username?.trim() ||
    usernameFor?.(a.actor_id) ||
    'Unknown user'
  );
}

function actorContext(a: DocumentWorkflowAction): string {
  const parts: string[] = [];
  const title = actorTitle(a);
  if (title) parts.push(title);
  if (a.actor_department?.trim()) parts.push(a.actor_department.trim());
  if (a.actor_zone?.trim()) parts.push(a.actor_zone.trim());
  else if (a.actor_state?.trim()) parts.push(a.actor_state.trim());
  return parts.join(' · ');
}

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/_/g, ' ');
}

function renderMetaList(items: Array<[string, string | null | undefined]>): string {
  return items
    .map(
      ([label, value]) =>
        `<div class="meta-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '—')}</dd></div>`
    )
    .join('');
}

function renderRecipients(
  recipients: DocumentRecipient[] | undefined,
  usernameFor?: (id: string | null | undefined) => string
): string {
  if (!recipients?.length) {
    return '<p class="empty">No recipients tagged on this document.</p>';
  }
  const rows = recipients
    .map((r) => {
      const name = usernameFor?.(r.user_id) || r.user_id;
      const type = RECIPIENT_TYPE_LABEL[r.recipient_type] ?? r.recipient_type.toUpperCase();
      const when = r.created_at ? safeFormatDate(r.created_at, 'PP p') : '';
      return `
        <li class="row">
          <span class="badge">${escapeHtml(type)}</span>
          <span class="name">${escapeHtml(name)}</span>
          ${when ? `<span class="muted">${escapeHtml(when)}</span>` : ''}
        </li>`;
    })
    .join('');
  return `<ul class="list">${rows}</ul>`;
}

function renderAttachments(
  attachments: DocumentAttachment[] | undefined,
  usernameFor?: (id: string | null | undefined) => string
): string {
  if (!attachments?.length) {
    return '<p class="empty">No attachments uploaded.</p>';
  }
  const rows = attachments
    .map((att) => {
      const uploader = att.uploaded_by ? usernameFor?.(att.uploaded_by) || '' : '';
      const size = formatFileSize(att.file_size);
      const when = att.created_at ? safeFormatDate(att.created_at, 'PP p') : '';
      return `
        <li class="row">
          <span class="name">${escapeHtml(att.filename || 'Attachment')}</span>
          ${size ? `<span class="muted">${escapeHtml(size)}</span>` : ''}
          ${uploader ? `<span class="muted">by ${escapeHtml(uploader)}</span>` : ''}
          ${when ? `<span class="muted">${escapeHtml(when)}</span>` : ''}
        </li>`;
    })
    .join('');
  return `<ul class="list">${rows}</ul>`;
}

function renderActions(
  actions: DocumentWorkflowAction[] | undefined,
  usernameFor?: (id: string | null | undefined) => string
): string {
  if (!actions?.length) {
    return '<p class="empty">No activity recorded yet.</p>';
  }
  const sorted = [...actions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const rows = sorted
    .map((a) => {
      const ctx = actorContext(a);
      const comment = a.comment?.trim();
      return `
        <li class="activity-item">
          <p class="activity-when">${escapeHtml(safeFormatDate(a.created_at, 'PP p'))}</p>
          <p class="activity-actor">
            <span class="actor-name">${escapeHtml(actorName(a, usernameFor))}</span>
            ${ctx ? `<span class="muted"> · ${escapeHtml(ctx)}</span>` : ''}
          </p>
          <p class="activity-action">${escapeHtml(actionLabel(a.action))}</p>
          ${comment ? `<div class="activity-comment">${escapeHtml(comment)}</div>` : ''}
        </li>`;
    })
    .join('');
  return `<ul class="activity-list">${rows}</ul>`;
}

function renderVersions(versions: DocumentVersion[] | undefined): string {
  if (!versions?.length) return '';
  const rows = versions
    .slice()
    .sort((a, b) => b.version_number - a.version_number)
    .map(
      (v) => `
        <li class="row">
          <span class="name">Version ${escapeHtml(v.version_number)}</span>
          <span class="muted">${escapeHtml(safeFormatDate(v.created_at, 'PP p'))}</span>
        </li>`
    )
    .join('');
  return `<ul class="list">${rows}</ul>`;
}

function additionalSectionsHtml({
  doc,
  recipients,
  attachments,
  actions,
  versions,
  ownerName,
  usernameFor,
}: DocumentExportInput): string {
  const profileMeta: Array<[string, string | null | undefined]> = [
    ['Reference number', doc.ref_number],
    ['Status', doc.status_label || doc.status],
    ['Category', doc.category ? CATEGORY_LABEL[doc.category] ?? doc.category : null],
    ['Department', doc.department],
    ['Urgency', doc.urgency ? URGENCY_LABEL[doc.urgency] ?? doc.urgency : null],
    [
      'Classification',
      doc.file_classification ? CLASSIFICATION_LABEL[doc.file_classification] ?? doc.file_classification : null,
    ],
    ['Delivery mode', doc.delivery_mode ? DELIVERY_LABEL[doc.delivery_mode] ?? doc.delivery_mode : null],
    [
      'Input mode',
      doc.input_mode ? (doc.input_mode === 'template' ? 'Template' : 'Manual entry') : null,
    ],
    ['Effective date', doc.document_effective_date ? safeFormatDate(doc.document_effective_date, 'PP') : null],
    ['Received', doc.receive_recorded_at ? safeFormatDate(doc.receive_recorded_at, 'PP p') : null],
    ['Created', safeFormatDate(doc.created_at, 'PP p')],
    ['Last updated', safeFormatDate(doc.updated_at, 'PP p')],
    ['Owner', ownerName],
  ];

  const profileBlock = renderMetaList(profileMeta);
  const recipientsBlock = renderRecipients(recipients, usernameFor);
  const attachmentsBlock = renderAttachments(attachments, usernameFor);
  const activityBlock = renderActions(actions, usernameFor);
  const versionsBlock = renderVersions(versions);

  return `
    <section class="export-section export-meta-section">
      <h2>Document profile</h2>
      <dl class="meta-grid">${profileBlock}</dl>
    </section>
    <section class="export-section">
      <h2>Recipients</h2>
      ${recipientsBlock}
    </section>
    <section class="export-section">
      <h2>Attachments</h2>
      ${attachmentsBlock}
    </section>
    <section class="export-section">
      <h2>Comments &amp; activity</h2>
      ${activityBlock}
    </section>
    ${versionsBlock ? `<section class="export-section"><h2>Version history</h2>${versionsBlock}</section>` : ''}
  `;
}

/**
 * Render the standalone body shell used when no server letterhead is available
 * (e.g. external correspondence). Keeps a similar header so the export still
 * looks like a formal document.
 */
function bodyShell(doc: Document, bodyHtml: string): string {
  const title = escapeHtml(doc.title || 'Untitled document');
  const refLine = doc.ref_number ? `<p class="ref">Ref: ${escapeHtml(doc.ref_number)}</p>` : '';
  const logoSrc = escapeHtml(NHIA_LOGO_SRC);
  return `
    <header class="doc-header">
      <img class="export-doc-logo" src="${logoSrc}" alt="NHIA" />
      <h1>${title}</h1>
      ${refLine}
    </header>
    <article class="doc-body">${bodyHtml || '<p class="empty">No body content.</p>'}</article>
  `;
}

const EXPORT_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #ffffff; margin: 0; padding: 32px; }
  .export-wrap { max-width: 880px; margin: 0 auto; }
  .toolbar { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 16px; }
  .toolbar button { font: inherit; padding: 6px 14px; border-radius: 6px; border: 1px solid #d1d5db; background: #ffffff; cursor: pointer; color: #111827; }
  .toolbar button.primary { background: #1f2937; color: #ffffff; border-color: #1f2937; }
  .toolbar button:hover { background: #f3f4f6; }
  .toolbar button.primary:hover { background: #111827; }
  .export-doc-logo { display: block; height: 44px; width: auto; max-width: 260px; object-fit: contain; margin: 0 0 14px; }
  .doc-header h1 { font-size: 22px; margin: 0 0 4px; color: #111827; }
  .doc-header .ref { margin: 0 0 16px; color: #6b7280; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .doc-body { font-size: 14px; line-height: 1.55; }
  .doc-body p, .doc-body li { line-height: 1.55; }
  .export-section { margin-top: 32px; }
  .export-section h2 { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
  .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 24px; margin: 0; }
  .meta-row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; padding: 6px 0; border-bottom: 1px dashed #f3f4f6; }
  .meta-row dt { color: #6b7280; font-weight: 500; }
  .meta-row dd { margin: 0; color: #111827; font-weight: 500; text-align: right; max-width: 60%; }
  .list { list-style: none; padding: 0; margin: 0; }
  .list .row { display: flex; align-items: center; gap: 10px; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
  .list .row .badge { display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: #eef2ff; color: #4338ca; text-transform: uppercase; letter-spacing: 0.04em; }
  .list .row .name { font-weight: 500; color: #111827; }
  .list .row .muted { color: #6b7280; font-size: 12px; margin-left: auto; }
  .list .row .muted + .muted { margin-left: 8px; }
  .empty { color: #6b7280; font-style: italic; font-size: 13px; margin: 0; }
  .activity-list { list-style: none; padding: 0; margin: 0; }
  .activity-item { padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
  .activity-when { color: #6b7280; font-size: 12px; margin: 0 0 4px; font-variant-numeric: tabular-nums; }
  .activity-actor { margin: 0 0 4px; font-size: 13px; }
  .activity-actor .actor-name { font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.01em; }
  .activity-actor .muted { color: #6b7280; font-weight: 400; }
  .activity-action { margin: 0 0 4px; font-size: 13px; color: #4338ca; font-weight: 500; }
  .activity-comment { background: #f9fafb; border-left: 3px solid #d1d5db; padding: 8px 12px; margin-top: 6px; color: #111827; font-size: 13px; white-space: pre-wrap; border-radius: 0 6px 6px 0; }
  @media print {
    body { padding: 0; }
    .toolbar { display: none; }
    .export-section { break-inside: avoid; }
    .activity-item { break-inside: avoid; }
  }
`;

const TOOLBAR_HTML = `
  <div class="toolbar no-print">
    <button type="button" onclick="window.print()" class="primary">Print / Save as PDF</button>
    <button type="button" onclick="window.close()">Close</button>
  </div>
`;

/**
 * Try to inject `additional` HTML before the closing `</body>` of an existing
 * HTML document. Falls back to appending when no `</body>` tag exists.
 */
function injectIntoLetterhead(letterheadHtml: string, additional: string, toolbar: string): string {
  const styleTag = `<style data-export-styles="true">${EXPORT_STYLES}</style>`;
  const headSplit = letterheadHtml.indexOf('</head>');
  const withStyles =
    headSplit === -1
      ? styleTag + letterheadHtml
      : letterheadHtml.slice(0, headSplit) + styleTag + letterheadHtml.slice(headSplit);
  const bodyClose = withStyles.lastIndexOf('</body>');
  const block = `${toolbar}${additional}`;
  if (bodyClose === -1) {
    return `${withStyles}${block}`;
  }
  return withStyles.slice(0, bodyClose) + block + withStyles.slice(bodyClose);
}

export function buildDocumentExportHtml(input: DocumentExportInput): string {
  const { doc, letterheadHtml } = input;
  const additional = additionalSectionsHtml(input);

  if (letterheadHtml && letterheadHtml.trim().length > 0) {
    return injectIntoLetterhead(letterheadHtml, `<div class="export-wrap">${additional}</div>`, TOOLBAR_HTML);
  }

  const title = escapeHtml(doc.title || 'Document export');
  const shell = bodyShell(doc, doc.content ?? '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title} — Export</title>
  <style>${EXPORT_STYLES}</style>
</head>
<body>
  <div class="export-wrap">
    ${TOOLBAR_HTML}
    ${shell}
    ${additional}
  </div>
</body>
</html>`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error('read failed'));
    fr.readAsDataURL(blob);
  });
}

/**
 * Fetches same-origin `<img src="...">` resources and replaces them with `data:` URLs.
 * Export HTML is opened in a new tab (`about:blank`), so paths like `/logo.png` do not
 * resolve against the app origin — inlining fixes letterhead logos and body images for print/PDF.
 */
export async function inlineExportImagesInHtml(html: string): Promise<string> {
  const trimmed = html.trim();
  if (!trimmed) return html;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return html;

  try {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(trimmed, 'text/html');
    const imgs = [...parsed.querySelectorAll('img[src]')];
    const origin = window.location.origin;

    await Promise.all(
      imgs.map(async (img) => {
        let src = img.getAttribute('src')?.trim();
        if (src === '/logo.png') {
          img.setAttribute('src', NHIA_LOGO_SRC);
          src = NHIA_LOGO_SRC;
        }
        if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;

        let absolute: string;
        try {
          absolute = new URL(src, origin).href;
        } catch {
          return;
        }

        let url: URL;
        try {
          url = new URL(absolute);
        } catch {
          return;
        }
        if (url.origin !== origin) return;

        try {
          const res = await fetch(url.href, { credentials: 'include' });
          if (!res.ok) return;
          const blob = await res.blob();
          if (!blob.size) return;
          const dataUrl = await blobToDataUrl(blob);
          img.setAttribute('src', dataUrl);
        } catch {
          /* keep original src */
        }
      })
    );

    const doctype = trimmed.match(/^<!DOCTYPE[^>]*>/i)?.[0] ?? '<!DOCTYPE html>';
    return `${doctype}\n${parsed.documentElement.outerHTML}`;
  } catch {
    return html;
  }
}
