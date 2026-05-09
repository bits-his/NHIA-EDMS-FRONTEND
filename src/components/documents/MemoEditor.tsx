import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor,
  Bold, Italic, Underline, Strikethrough,
  Essentials, Paragraph, Heading,
  List,
  Indent, IndentBlock,
  Alignment,
  Table, TableToolbar,
  Link,
  Undo,
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';
import { NhiaMemoLetterhead } from '@/components/documents/NhiaMemoLetterhead';

interface MemoEditorProps {
  value: string;
  onChange: (value: string) => void;
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

export default function MemoEditor({
  value,
  onChange,
  documentTypeLabel,
  letterheadZoneCode,
  letterheadStateOfficeName,
  letterheadZones,
}: MemoEditorProps) {
  const initialData = value || INITIAL_CONTENT;

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      <NhiaMemoLetterhead
        documentTypeLabel={documentTypeLabel}
        zoneCode={letterheadZoneCode}
        stateOfficeName={letterheadStateOfficeName}
        zones={letterheadZones}
      />

      {/* Editor — min-height ensures the editable area is always visible */}
      <div className="[&_.ck-editor__editable]:min-h-[400px] [&_.ck-editor__editable]:px-8 [&_.ck-editor__editable]:py-4">
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
              Table, TableToolbar,
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
          }}
          onChange={(_event, editor) => onChange(editor.getData())}
        />
      </div>
    </div>
  );
}
