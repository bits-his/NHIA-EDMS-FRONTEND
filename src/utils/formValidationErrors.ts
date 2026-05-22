import type { FieldErrors, FieldValues } from 'react-hook-form';

/** Human labels for create-document form fields (keys match react-hook-form paths). */
const CREATE_DOCUMENT_FIELD_LABELS: Record<string, string> = {
  delivery_mode: 'Delivery mode',
  document_source: 'Document source',
  document_type: 'Document type',
  document_date: 'Document date',
  document_template_id: 'Document template',
  subject: 'Subject',
  body_html: 'Body',
  body_text_external: 'Cover notes',
  file_category: 'File category',
  document_priority: 'Priority',
  file_name: 'File name',
  ref_code: 'Reference code',
  correspondence_direction: 'Correspondence (incoming/outgoing)',
  action: 'Action',
  tagged_recipients: 'Recipients',
  workflow_template_id: 'Workflow',
  user_id: 'Recipient',
  recipient_type: 'Recipient type',
};

function labelForField(path: string): string {
  return CREATE_DOCUMENT_FIELD_LABELS[path] ?? path.replace(/_/g, ' ');
}

function humanizeZodMessage(path: string, message: string): string {
  const label = labelForField(path);
  if (message === 'Required' || message === 'Invalid input') {
    return `${label} is required`;
  }
  if (message.startsWith('Required')) {
    return `${label} ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
  }
  if (/^Invalid enum/i.test(message)) {
    return `${label}: choose a valid option`;
  }
  if (/^Invalid uuid/i.test(message)) {
    return `${label}: invalid selection`;
  }
  return `${label}: ${message}`;
}

/**
 * Flatten react-hook-form errors into user-facing sentences (replaces bare "Required").
 */
export function formatFormValidationErrors<T extends FieldValues>(
  errors: FieldErrors<T>,
  prefix = ''
): string[] {
  const out: string[] = [];
  for (const key of Object.keys(errors)) {
    const field = errors[key as keyof typeof errors];
    if (!field) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof field === 'object' && field !== null && 'message' in field && field.message) {
      out.push(humanizeZodMessage(path, String(field.message)));
    } else if (typeof field === 'object' && field !== null) {
      out.push(...formatFormValidationErrors(field as FieldErrors<T>, path));
    }
  }
  return out;
}

export function firstFormValidationError<T extends FieldValues>(errors: FieldErrors<T>): string {
  const list = formatFormValidationErrors(errors);
  return list[0] ?? 'Please complete the required fields below.';
}

export function formValidationSummary<T extends FieldValues>(errors: FieldErrors<T>): string {
  const list = formatFormValidationErrors(errors);
  if (list.length === 0) return 'Please complete the required fields below.';
  if (list.length === 1) return list[0];
  return list.slice(0, 4).join(' · ') + (list.length > 4 ? ` (+${list.length - 4} more)` : '');
}
