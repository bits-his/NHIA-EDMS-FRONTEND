/** Shown when approve-and-send or final-approve requires a saved signature. */
export const ESIGNATURE_SETUP_MESSAGE =
  'Add your e-signature under Settings → E-signature before you can approve and send or final-approve. Your signature is appended to the memo.';

export const DM_ACTIONS_REQUIRING_SIGNATURE = new Set(['approve_send', 'final_approval']);

export function directMessageActionRequiresSignature(
  actionType: string | null | undefined
): boolean {
  return DM_ACTIONS_REQUIRING_SIGNATURE.has(String(actionType ?? '').trim());
}

export function userHasEsignatureOnFile(
  profile: { signature_path?: string | null } | null | undefined
): boolean {
  return Boolean(profile?.signature_path?.trim());
}
