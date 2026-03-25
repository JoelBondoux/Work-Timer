import type { RunningTimer, BillingRecord, ProjectTotal, Project } from '../types.js';

const CONTROL_CHARS_REGEX = /[\u0000-\u001f\u007f-\u009f]/g;
const ANSI_ESCAPE_REGEX = /\u001b\[[0-?]*[ -/]*[@-~]/g;

export function sanitizeTerminalText(value: string): string {
  return value
    .replace(ANSI_ESCAPE_REGEX, '')
    .replace(CONTROL_CHARS_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.floor((minutes * 60) % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatRunningTimers(timers: RunningTimer[]): string {
  if (timers.length === 0) {
    return 'No running timers.';
  }

  const lines = ['Running Timers:'];
  for (const t of timers) {
    const safeProjectName = sanitizeTerminalText(t.project_name);
    const safeNotes = t.notes ? sanitizeTerminalText(t.notes) : '';
    const status = t.status === 'paused' ? ' (PAUSED)' : '';
    const notes = safeNotes ? ` — ${safeNotes}` : '';
    lines.push(
      `  #${t.session_id} ${safeProjectName}  ${formatDuration(t.elapsed_minutes)}  (started ${t.start_time})${status}${notes}`
    );
  }
  return lines.join('\n');
}

export function formatBillingRecords(records: BillingRecord[]): string {
  if (records.length === 0) {
    return 'No billing records found.';
  }

  const lines = ['Billing Records:'];
  lines.push(
    '  ID    | Project              | Date       | Duration | Billed   | Amount      | Status'
  );
  lines.push('  ' + '-'.repeat(95));

  for (const r of records) {
    const duration = formatDuration(r.raw_duration_minutes);
    const billed = formatDuration(r.billed_duration_minutes);
    const amount = `${sanitizeTerminalText(r.currency)} ${r.amount.toFixed(2)}`;
    const safeProjectName = sanitizeTerminalText(r.project_name);
    const status = [
      r.invoiced ? 'INV' : '',
      r.paid ? 'PAID' : '',
    ]
      .filter(Boolean)
      .join(', ') || 'pending';

    lines.push(
      `  #${String(r.session_id).padEnd(4)} | ${safeProjectName.padEnd(20).slice(0, 20)} | ${r.date} | ${duration} | ${billed} | ${amount.padEnd(11)} | ${status}`
    );
  }

  return lines.join('\n');
}

export function formatProjectTotals(totals: Map<string, ProjectTotal>): string {
  if (totals.size === 0) {
    return 'No totals to display.';
  }

  const lines = ['Project Totals:'];
  for (const [, total] of totals) {
    const hours = (total.total_billed_minutes / 60).toFixed(2);
    lines.push(
      `  ${sanitizeTerminalText(total.project_name)}: ${hours}h billed — ${sanitizeTerminalText(total.currency)} ${total.total_amount.toFixed(2)}`
    );
  }
  return lines.join('\n');
}

export function formatProject(project: Project, effective?: { rate: number; currency: string; minBlock: number }): string {
  const safeName = sanitizeTerminalText(project.name);
  const lines = [`Project: ${safeName}`];
  if (project.billing_rate !== null) {
    lines.push(`  Rate: ${project.billing_rate}/hr`);
  } else if (effective) {
    lines.push(`  Rate: ${effective.rate}/hr (default)`);
  }
  if (project.currency !== null) {
    lines.push(`  Currency: ${sanitizeTerminalText(project.currency)}`);
  } else if (effective) {
    lines.push(`  Currency: ${sanitizeTerminalText(effective.currency)} (default)`);
  }
  if (project.min_block_minutes !== null) {
    lines.push(`  Min block: ${project.min_block_minutes} min`);
  } else if (effective) {
    lines.push(`  Min block: ${effective.minBlock} min (default)`);
  }
  if (project.archived) {
    lines.push('  Status: ARCHIVED');
  }
  return lines.join('\n');
}

export function formatProjectList(projects: Project[]): string {
  if (projects.length === 0) {
    return 'No projects found.';
  }
  const lines = ['Projects:'];
  for (const p of projects) {
    const rate = p.billing_rate !== null ? `${p.billing_rate}/hr` : 'default';
    const currency = sanitizeTerminalText(p.currency ?? 'default');
    const archived = p.archived ? ' [ARCHIVED]' : '';
    lines.push(`  ${sanitizeTerminalText(p.name)} — ${currency} ${rate}${archived}`);
  }
  return lines.join('\n');
}
