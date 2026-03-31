export function requireConfirmation(
  dryRun: boolean | undefined,
  confirmPhrase: string | undefined,
  expectedPhrase: string,
): { allowed: boolean; message?: string } {
  if (dryRun) {
    return { allowed: false };
  }

  if (confirmPhrase === expectedPhrase) {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: `Confirmation required. Re-run with confirm_phrase exactly "${expectedPhrase}" or set dry_run: true to preview impact first.`,
  };
}
