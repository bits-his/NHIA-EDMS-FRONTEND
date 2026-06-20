/** Shown when the user opts in to append a signature but has none saved. */
export const ESIGNATURE_SETUP_MESSAGE =
  'Add your e-signature under Settings → E-signature before you can append your signature to the memo.';

export const DM_ACTIONS_SUPPORTING_SIGNATURE = new Set(['approve_send', 'final_approval']);

/** @deprecated Use optional append flow — signature is not required unless the user opts in. */
export function directMessageActionRequiresSignature(
  actionType: string | null | undefined
): boolean {
  return DM_ACTIONS_SUPPORTING_SIGNATURE.has(String(actionType ?? '').trim());
}

export function directMessageActionSupportsSignature(
  actionType: string | null | undefined
): boolean {
  return DM_ACTIONS_SUPPORTING_SIGNATURE.has(String(actionType ?? '').trim());
}

export function workflowActionSupportsSignature(
  actionType: string | null | undefined
): boolean {
  const at = String(actionType ?? '').trim();
  return at === 'final_approve' || at === 'approve' || at === 'approve_forward';
}

export function userHasEsignatureOnFile(
  profile: { signature_path?: string | null } | null | undefined
): boolean {
  return Boolean(profile?.signature_path?.trim());
}
