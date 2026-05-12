import type { Document } from '@/types/document';

/** List/detail primary label: document type, not template name in `title`. */
export function documentTypeHeadline(doc: Document): string {
  if (doc.category === 'internal_memo') return 'Internal memo';
  if (doc.category === 'external_correspondence') return 'External correspondence';
  return doc.title;
}

export function shouldShowTemplateTitleAsSubtitle(doc: Document): boolean {
  if (!doc.title?.trim()) return false;
  return doc.category === 'internal_memo' || doc.category === 'external_correspondence';
}

/**
 * Memo templates often put the catalogue/template name as the first `p` / `h1`–`h6` block.
 * When that text equals `document.title`, drop that block so the body does not repeat the template name.
 */
export function stripFirstHtmlBlockMatchingTitle(html: string, title: string | undefined): string {
  if (!html?.trim() || !title?.trim()) return html;
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const target = norm(title);

  const wrapped = `<div data-memo-strip-root>${html}</div>`;
  const doc = new DOMParser().parseFromString(wrapped, 'text/html');
  const root = doc.body.querySelector('[data-memo-strip-root]');
  if (!root) return html;

  const findFirstBlock = (container: Element, depth: number): Element | null => {
    if (depth > 12) return null;
    for (const node of container.children) {
      if (!(node instanceof HTMLElement)) continue;
      if (/^P$|^H[1-6]$/i.test(node.tagName)) return node;
      const inner = findFirstBlock(node, depth + 1);
      if (inner) return inner;
    }
    return null;
  };

  const block = findFirstBlock(root, 0);
  if (!block || norm(block.textContent ?? '') !== target) return html;
  block.remove();
  return root.innerHTML.trim();
}
