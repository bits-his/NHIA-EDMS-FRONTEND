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

interface MemoEditorProps {
  value: string;
  onChange: (value: string) => void;
  title?: string;
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

export default function MemoEditor({ value, onChange, title }: MemoEditorProps) {
  const initialData = value || INITIAL_CONTENT;

  return (
    <div className="border rounded-lg bg-white shadow-sm">
      {/* Letterhead */}
      <div className="bg-white border-b px-8 py-6 text-center">
        <div className="flex items-center justify-center gap-4 mb-3">
          <img src="/logo.png" alt="NHIA Logo" className="h-16 w-16 object-contain" />
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Federal Republic of Nigeria</p>
            <h1 className="text-lg font-bold text-green-800 leading-tight">
              National Health Insurance Authority
            </h1>
            <p className="text-xs text-gray-600">Plot 297, Herbert Macaulay Way, Central Business District, Abuja</p>
          </div>
        </div>
        <div className="border-t-4 border-green-700 mt-2 pt-2">
          <p className="text-sm font-bold uppercase tracking-widest text-gray-700">
            Internal Memorandum
          </p>
          {title && <p className="text-xs text-gray-500 mt-0.5">{title}</p>}
        </div>
      </div>

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
