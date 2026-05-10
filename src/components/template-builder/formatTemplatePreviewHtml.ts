/** Sample substitutions for `{{…}}` tokens — preview only; generation replaces at runtime. */

const PREVIEW_SAMPLES: Record<string, string> = {
  agency_name: 'National Health Insurance Authority (NHIA)',
  staff_id: 'NHIA/HR/10248',
  applicant_name: 'Mr. Adamu Bello',
  staff_name: 'Ms. Chinelo Okafor',
  name: 'Dr. Ibrahim Musa',
  designation: 'Chief Administrative Officer',
  prepared_by: 'Mrs. Ngozi Eze — Planning Unit',
  fiscal_year: '2026',
  reporting_period: 'Q1 2026',
  department: 'Corporate Services',
  approval_date: '9 May 2026',
  reference_number: 'NHIA/MEMO/2026/00123',
  zone: 'North-Central',
  state_office: 'FCT',
  headquarters: 'Abuja HQ',
  unit: 'Records & Archives Unit',
  workflow_status: 'Pending approval (Executive routing)',
  directorate: 'Directorate of Corporate Services',
  classification: 'Official — Internal Use',
  'e-signature': `<div class="nhia-preview-sig mt-3 flex flex-col gap-1 border-t border-dashed border-slate-300 pt-3 dark:border-slate-600"><span class="font-serif text-lg italic text-slate-800 dark:text-slate-200">Ibrahim M.</span><span class="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Electronically signed · preview sample</span></div>`,
};

const TOKEN_RE = /\{\{([\w.-]+)\}\}/g;

export function formatTemplatePreviewHtml(html: string): string {
  const trimmed = html?.trim() ?? '';
  if (!trimmed) return '';

  return trimmed.replace(TOKEN_RE, (_, key: string) => {
    const sample = PREVIEW_SAMPLES[key];
    if (sample !== undefined) return sample;
    return `<span class="rounded bg-amber-100/90 px-1 font-mono text-[11px] text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">{{${key}}}</span>`;
  });
}
