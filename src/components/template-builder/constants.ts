/** Grouped options for “Template Document Type” selector — enterprise records taxonomy. */

export const TEMPLATE_DOCUMENT_GROUPS = [
  {
    label: 'Administrative Communication Templates',
    items: [
      { value: 'internal_memo', label: 'Internal Memo Template' },
      { value: 'circular', label: 'Circular Template' },
      { value: 'notice', label: 'Notice Template' },
      { value: 'meeting_agenda', label: 'Meeting Agenda Template' },
      { value: 'minutes', label: 'Meeting Minutes Template' },
      { value: 'staff_correspondence', label: 'Staff Correspondence Template' },
      { value: 'inter_office_communication', label: 'Inter-Office Communication Template' },
      { value: 'deployment_letter', label: 'Deployment Letter Template' },
      { value: 'query_letter', label: 'Query Letter Template' },
      { value: 'response_to_query', label: 'Response to Query Template' },
      { value: 'approval_note', label: 'Approval Note Template' },
    ],
  },
  {
    label: 'Executive & Decision Templates',
    items: [
      { value: 'executive_approval', label: 'Executive Approval Template' },
      { value: 'decision_brief', label: 'Decision Brief Template' },
      { value: 'policy_directive', label: 'Policy Directive Template' },
      { value: 'board_paper', label: 'Board Paper Template' },
      { value: 'management_report', label: 'Management Report Template' },
      { value: 'strategic_plan', label: 'Strategic Plan Template' },
      { value: 'performance_dashboard', label: 'Performance Dashboard Template' },
      { value: 'budget_approval', label: 'Budget Approval Template' },
      { value: 'procurement_approval', label: 'Procurement Approval Template' },
    ],
  },
  {
    label: 'HR Templates',
    items: [
      { value: 'staff_personal_record', label: 'Staff Personal Record Template' },
      { value: 'leave_application', label: 'Leave Application Template' },
      { value: 'promotion_letter', label: 'Promotion Letter Template' },
      { value: 'training_request', label: 'Staff Training Request Template' },
      { value: 'attendance_register', label: 'Daily Attendance Register Template' },
      { value: 'payroll_schedule', label: 'Payroll Schedule Template' },
      { value: 'recruitment', label: 'Recruitment Template' },
      { value: 'performance_appraisal', label: 'Performance Appraisal Template' },
      { value: 'disciplinary', label: 'Disciplinary Record Template' },
    ],
  },
  {
    label: 'Finance & Procurement Templates',
    items: [
      { value: 'invoice', label: 'Invoice Template' },
      { value: 'payment_voucher', label: 'Payment Voucher Template' },
      { value: 'procurement_request', label: 'Procurement Request Template' },
      { value: 'purchase_order', label: 'Purchase Order Template' },
      { value: 'contract_agreement', label: 'Contract Agreement Template' },
      { value: 'audit_report', label: 'Audit Report Template' },
    ],
  },
  {
    label: 'Healthcare / NHIA Templates',
    items: [
      { value: 'enrollee_registration', label: 'Enrollee Registration Template' },
      { value: 'claims_submission', label: 'Claims Submission Template' },
      { value: 'provider_accreditation', label: 'Provider Accreditation Template' },
      { value: 'authorization_request', label: 'Authorization Request Template' },
      { value: 'beneficiary_complaint', label: 'Beneficiary Complaint Template' },
    ],
  },
  {
    label: 'Legal & Compliance Templates',
    items: [
      { value: 'legal_opinion', label: 'Legal Opinion Template' },
      { value: 'compliance_report', label: 'Compliance Report Template' },
      { value: 'mou', label: 'MOU Template' },
      { value: 'sla', label: 'SLA Template' },
      { value: 'investigation_report', label: 'Investigation Report Template' },
    ],
  },
  {
    label: 'Security & Governance Templates',
    items: [
      { value: 'security_policy', label: 'Security Policy Template' },
      { value: 'cyber_incident', label: 'Cybersecurity Incident Template' },
      { value: 'access_authorization', label: 'Access Authorization Template' },
      { value: 'disaster_recovery', label: 'Disaster Recovery Template' },
    ],
  },
] as const;

export const SCOPE_LEVELS = [
  { value: 'all', label: 'All' },
  { value: 'unit', label: 'Unit Level' },
  { value: 'department', label: 'Department Level' },
  { value: 'directorate', label: 'Directorate Level' },
  { value: 'state_office', label: 'State Office Level' },
  { value: 'zonal', label: 'Zonal Level' },
  { value: 'headquarters', label: 'Headquarters Level' },
  { value: 'national', label: 'National Level' },
  { value: 'inter_agency', label: 'Inter-Agency' },
  { value: 'executive', label: 'Executive Level' },
] as const;

export const PLACEHOLDER_VARIABLES = [
  '{{staff_name}}',
  '{{name}}',
  '{{department}}',
  '{{approval_date}}',
  '{{reference_number}}',
  '{{zone}}',
  '{{state_office}}',
  '{{headquarters}}',
  '{{unit}}',
  '{{workflow_status}}',
  '{{directorate}}',
  '{{classification}}',
  '{{e-signature}}',
] as const;

export const WORKFLOW_CONDITION_PRESETS = [
  'If zone = Headquarters',
  'If state office = Abuja',
  'If confidential = true',
  'If procurement type = emergency',
  'If department = Finance',
  'If template scope = National',
] as const;

export const APPROVAL_ENTITY_LABELS = [
  'Unit Head',
  'Department Head',
  'Directorate Office',
  'State Office Coordinator',
  'Zonal Coordinator',
  'Headquarters Management',
  'Director General',
] as const;
