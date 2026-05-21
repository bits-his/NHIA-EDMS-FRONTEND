import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor,
  Bold, Italic, Underline, Strikethrough,
  Essentials, Paragraph, Heading,
  List,
  Indent, IndentBlock,
  Alignment,
  Table,
  TableToolbar,
  TableColumnResize,
  GeneralHtmlSupport,
  Link,
  Undo,
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';
import { NhiaMemoLetterhead } from '@/components/documents/NhiaMemoLetterhead';

interface MemoEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** When true, only the CKEditor is shown (no NHIA letterhead above the editable area). */
  hideLetterhead?: boolean;
  /**
   * When true and `value` is empty, the editor starts with a single empty paragraph instead of the memo boilerplate.
   */
  startBlank?: boolean;
  /** Min height of the editable area in pixels (default 400). */
  editorMinHeight?: number;
  /** Template document type catalogue label; letterhead omits the trailing word “Template”. */
  documentTypeLabel?: string;
  /** Letterhead address line: zone/state from organisational scope (with `letterheadZones`). */
  letterheadZoneCode?: string;
  letterheadStateOfficeName?: string;
  letterheadZones?: { code: string; name: string }[];
}

const today = new Date().toLocaleDateString('en-NG', {
  day: 'numeric', month: 'long', year: 'numeric',
});

const INITIAL_CONTENT = `
<p><strong>DATE:</strong> ${today}</p>
<p><strong>REF NO:</strong> &nbsp;</p>
<p><strong>TO:</strong> &nbsp;</p>
<p><strong>THROUGH:</strong> &nbsp;</p>
<p><strong>FROM:</strong> &nbsp;</p>
<p><strong>SUBJECT:</strong> &nbsp;</p>
<hr>
<p>&nbsp;</p>
<p>&nbsp;</p>
<p>&nbsp;</p>
<hr>
<p><strong>Signature:</strong> ___________________________</p>
<p><strong>Name:</strong> &nbsp;</p>
<p><strong>Designation:</strong> &nbsp;</p>
<p><strong>Date:</strong> &nbsp;</p>
`;

function normalizeEditorHtml(html: string): string {
  if (!html) return html;
  return (
    html
      // Allow checkbox interaction in editable content.
      .replace(/(<input\b[^>]*\btype\s*=\s*["']checkbox["'][^>]*?)\sdisabled(\s|>)/gi, '$1$2')
      .replace(/(<input\b[^>]*\btype\s*=\s*["']checkbox["'][^>]*?)\sreadonly(\s|>)/gi, '$1$2')
  );
}

/** CKEditor keeps form state in the model; sync DOM checkbox toggles back into `setData` HTML. */
function bindCheckboxClickSync(editor: {
  getData: () => string;
  setData: (html: string) => void;
  ui?: { view?: { editable?: { element?: HTMLElement | null } } };
}): () => void {
  const editable = editor.ui?.view?.editable?.element ?? null;
  if (!editable) return () => {};

  const syncFromDom = () => {
    const live = Array.from(editable.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    if (!live.length) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = editor.getData();
    const inData = wrap.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    if (inData.length !== live.length) return;
    for (let i = 0; i < live.length; i++) {
      const want = live[i].checked;
      const node = inData[i];
      if (want) node.setAttribute('checked', 'checked');
      else node.removeAttribute('checked');
    }
    editor.setData(wrap.innerHTML);
  };

  const onPointerDown = (ev: PointerEvent) => {
    const path = ev.composedPath();
    const input = path.find(
      (n): n is HTMLInputElement =>
        n instanceof HTMLInputElement &&
        n.type === 'checkbox' &&
        editable.contains(n)
    );
    if (!input) return;
    ev.preventDefault();
    ev.stopPropagation();
    const next = !input.checked;
    input.checked = next;
    if (next) input.setAttribute('checked', 'checked');
    else input.removeAttribute('checked');
    queueMicrotask(syncFromDom);
  };

  editable.addEventListener('pointerdown', onPointerDown, true);
  return () => editable.removeEventListener('pointerdown', onPointerDown, true);
}

export default function MemoEditor({
  value,
  onChange,
  hideLetterhead = false,
  startBlank = false,
  editorMinHeight = 400,
  documentTypeLabel,
  letterheadZoneCode,
  letterheadStateOfficeName,
  letterheadZones,
}: MemoEditorProps) {
  const trimmed = value?.trim() ?? '';
  const initialData = normalizeEditorHtml(
    trimmed ? value : startBlank ? '<p></p>' : value || INITIAL_CONTENT
  );

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      {!hideLetterhead ? (
        <NhiaMemoLetterhead
          documentTypeLabel={documentTypeLabel}
          zoneCode={letterheadZoneCode}
          stateOfficeName={letterheadStateOfficeName}
          zones={letterheadZones}
        />
      ) : null}

      {/* Editor — min-height ensures the editable area is always visible */}
      <div
        className="[&_.ck-editor__editable]:min-h-[var(--memo-editor-min-h)] [&_.ck-editor__editable]:px-8 [&_.ck-editor__editable]:py-4"
        style={{ ['--memo-editor-min-h' as string]: `${editorMinHeight}px` }}
      >
        <CKEditor
          editor={ClassicEditor}
          data={initialData}
          config={{
            plugins: [
              Essentials, Bold, Italic, Underline, Strikethrough,
              Paragraph, Heading,
              List,
              Indent, IndentBlock,
              Alignment,
              Table,
              TableToolbar,
              TableColumnResize,
              GeneralHtmlSupport,
              Link,
              Undo,
            ],
            toolbar: [
              'undo', 'redo', '|',
              'heading', '|',
              'bold', 'italic', 'underline', 'strikethrough', '|',
              'alignment', '|',
              'bulletedList', 'numberedList', 'outdent', 'indent', '|',
              'insertTable', 'link',
            ],
            licenseKey: 'GPL',
            table: { contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'] },
            htmlSupport: {
              allow: [
                {
                  name: 'input',
                  attributes: [
                    'type',
                    'checked',
                    'disabled',
                    'readonly',
                    'value',
                    'name',
                    'id',
                    'class',
                    'style',
                    'aria-checked',
                    'data-*',
                  ],
                  classes: true,
                  styles: true,
                },
                { name: 'label', attributes: ['for', 'class', 'style'], classes: true, styles: true },
              ],
            },
          }}
          onReady={(editor) => bindCheckboxClickSync(editor)}
          onChange={(_event, editor) => onChange(editor.getData())}
        />
      </div>
    </div>
  );
}
