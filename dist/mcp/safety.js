export function requireConfirmation(dryRun, confirmPhrase, expectedPhrase) {
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
//# sourceMappingURL=safety.js.map