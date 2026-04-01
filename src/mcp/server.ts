import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getClient } from '../db/client.js';
import { startTimer, stopTimer, pauseTimer, resumeTimer, getRunningTimers } from '../core/timer.js';
import {
  createProject,
  updateProject,
  listProjects,
  getProjectByName,
  findSimilarProjects,
  renameProject,
  deleteProject,
  mergeProjects,
  getProjectDeleteImpact,
  getProjectMergeImpact,
} from '../core/projects.js';
import { getSettings, updateSetting, getEffectiveRate, getEffectiveCurrency, getEffectiveMinBlock } from '../core/settings.js';
import { getBillingSummary } from '../core/billing.js';
import { markInvoiced, markPaid, querySessions, adjustSession, getSession } from '../core/sessions.js';
import { exportCsv, exportXlsx, exportPresetCsv } from '../core/export.js';
import { listPresetIds } from '../core/presets.js';
import { getMcpExportRoot, resolveMcpOutputPath } from '../core/output-path.js';
import {
  formatRunningTimers,
  formatBillingRecords,
  formatProjectTotals,
  formatProject,
  formatProjectList,
  formatDuration,
} from '../core/format.js';
import { localDateTimeToUtcDb, utcDbToLocal } from '../core/time.js';
import { requireConfirmation } from './safety.js';
import type { SettingKey } from '../types.js';

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

const server = new McpServer({
  name: 'work-timer',
  version: '1.3.14',
});

const nonNegativeFiniteNumber = z.number().finite().nonnegative();
const nonNegativeInteger = z.number().int().nonnegative();
const positiveInteger = z.number().int().positive();

const HELP_TOPICS = ['overview', 'timers', 'projects', 'billing', 'exports', 'setup', 'safety', 'examples'] as const;

function getWorkTimerHelp(topic: (typeof HELP_TOPICS)[number]): string {
  if (topic === 'timers') {
    return [
      'Timer workflow:',
      '- Start: timer_start (creates project when needed)',
      '- Pause/resume: timer_pause / timer_resume',
      '- Stop: timer_stop',
      '- Check active timers: timer_status',
      '- Multiple projects can run in parallel if needed',
    ].join('\n');
  }

  if (topic === 'projects') {
    return [
      'Project management:',
      '- Create/update/list/rename: project_create, project_update, project_list, project_rename',
      '- Delete and merge are safety-gated: project_delete, project_merge',
      '- Use dry_run first on destructive actions',
    ].join('\n');
  }

  if (topic === 'billing') {
    return [
      'Billing and records:',
      '- Query detailed records: time_query',
      '- Summarize unbilled/unpaid: billing_summary',
      '- Mark sessions: mark_invoiced, mark_paid',
      '- Adjust times safely: session_adjust (supports dry_run + confirm_phrase)',
    ].join('\n');
  }

  if (topic === 'exports') {
    return [
      'Export options:',
      '- CSV: export_csv',
      '- Excel workbook: export_xlsx',
      '- Accounting presets: export_preset (quickbooks, xero, freshbooks, sage, myob)',
    ].join('\n');
  }

  if (topic === 'setup') {
    return [
      'Setup checklist:',
      '- Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (or use work-timer setup in CLI)',
      '- Register MCP server in your client',
      '- Validate by calling timer_status or project_list',
    ].join('\n');
  }

  if (topic === 'safety') {
    return [
      'Safety model:',
      '- Destructive tools require an exact confirm_phrase',
      '- dry_run is available to preview impact before mutation',
      '- Prefer dry_run for project_delete, project_merge, and session_adjust',
    ].join('\n');
  }

  if (topic === 'examples') {
    return [
      'Example requests:',
      '- "Start a timer for Client Alpha at 150 USD/hr"',
      '- "Pause the timer for Client Alpha"',
      '- "Show unpaid totals for March"',
      '- "Export Xero CSV for last month to reports/xero.csv"',
    ].join('\n');
  }

  return [
    'Work-Timer MCP overview:',
    '- Core timers: start, pause, resume, stop, status',
    '- Projects: create/update/list/rename/delete/merge',
    '- Billing + sessions: query, summary, invoicing/payment, session_adjust',
    '- Exports: csv, xlsx, accounting presets',
    '- Safety: destructive actions support dry_run and require confirm_phrase',
    '- For deeper guidance, call work_timer_help with topic: timers, projects, billing, exports, setup, safety, examples',
  ].join('\n');
}

server.tool(
  'work_timer_help',
  'Return a beginner-friendly guide to Work-Timer capabilities and recommended usage patterns. Use this tool first when users ask what Work-Timer can do or how it works.',
  {
    topic: z.enum(HELP_TOPICS).optional().describe('Optional help topic. Defaults to overview.'),
  },
  async ({ topic }) => {
    return textResult(getWorkTimerHelp(topic ?? 'overview'));
  }
);

// --- Timer tools ---

server.tool(
  'timer_start',
  'Start a timer for a project. Creates the project if it does not exist. If no exact match is found but similar project names exist, returns a warning listing them — unless confirm_new_project is true.',
  {
    project: z.string().describe('Project name'),
    rate: nonNegativeFiniteNumber.optional().describe('Billing rate per hour'),
    currency: z.string().optional().describe('Currency code (e.g. USD, EUR, GBP)'),
    notes: z.string().optional().describe('Notes for this session'),
    confirm_new_project: z.boolean().optional().describe(
      'Set to true to create a new project even when similar names already exist'
    ),
  },
  async ({ project, rate, currency, notes, confirm_new_project }) => {
    try {
      const client = await getClient();

      if (!confirm_new_project) {
        const exact = await getProjectByName(client, project);
        if (!exact) {
          const similar = await findSimilarProjects(client, project);
          if (similar.length > 0) {
            const nameList = similar.map((p) => `"${p.name}"`).join(', ');
            return textResult(
              `No project named "${project}" exists, but similar projects were found: ${nameList}.\n` +
              `To use an existing project, pass its exact name. To create a new project named "${project}", set confirm_new_project: true.`
            );
          }
        }
      }

      const session = await startTimer(client, project, { rate, currency, notes });
      return textResult(
        `Timer started for "${session.project_name}" (session #${session.id})\nStarted at: ${utcDbToLocal(session.start_time)}`
      );
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

server.tool(
  'timer_stop',
  'Stop a running timer. If no project specified, stops the most recently started timer.',
  {
    project: z.string().optional().describe('Project name (optional — defaults to most recent)'),
  },
  async ({ project }) => {
    try {
      const client = await getClient();
      const session = await stopTimer(client, project);
      const durationMs =
        new Date(session.end_time! + 'Z').getTime() - new Date(session.start_time + 'Z').getTime();
      return textResult(
        `Timer stopped for "${session.project_name}" (session #${session.id})\nDuration: ${formatDuration(durationMs / 60000)}`
      );
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

server.tool(
  'timer_pause',
  'Pause a running timer. If no project specified, pauses the most recently started running timer.',
  {
    project: z.string().optional().describe('Project name (optional)'),
  },
  async ({ project }) => {
    try {
      const client = await getClient();
      const session = await pauseTimer(client, project);
      return textResult(`Timer paused for "${session.project_name}" (session #${session.id})`);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

server.tool(
  'timer_resume',
  'Resume a paused timer. If no project specified, resumes the most recently paused timer.',
  {
    project: z.string().optional().describe('Project name (optional)'),
  },
  async ({ project }) => {
    try {
      const client = await getClient();
      const session = await resumeTimer(client, project);
      return textResult(`Timer resumed for "${session.project_name}" (session #${session.id})`);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

server.tool(
  'timer_status',
  'Show all currently running and paused timers with elapsed time.',
  {},
  async () => {
    try {
      const client = await getClient();
      const timers = await getRunningTimers(client);
      return textResult(formatRunningTimers(timers));
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

// --- Project tools ---

server.tool(
  'project_create',
  'Create a new project with optional billing settings.',
  {
    name: z.string().describe('Project name'),
    rate: nonNegativeFiniteNumber.optional().describe('Billing rate per hour'),
    currency: z.string().optional().describe('Currency code'),
    min_block_minutes: nonNegativeInteger.max(1440).optional().describe('Minimum billing block in minutes'),
  },
  async ({ name, rate, currency, min_block_minutes }) => {
    try {
      const client = await getClient();
      const project = await createProject(client, name, { rate, currency, min_block_minutes });
      const effective = {
        rate: await getEffectiveRate(client, project),
        currency: await getEffectiveCurrency(client, project),
        minBlock: await getEffectiveMinBlock(client, project),
      };
      return textResult(`Created!\n${formatProject(project, effective)}`);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

server.tool(
  'project_update',
  'Update a project\'s billing settings.',
  {
    name: z.string().describe('Project name'),
    rate: nonNegativeFiniteNumber.optional().describe('New billing rate per hour'),
    currency: z.string().optional().describe('New currency code'),
    min_block_minutes: nonNegativeInteger.max(1440).optional().describe('New minimum billing block in minutes'),
    archived: z.boolean().optional().describe('Archive or unarchive the project'),
  },
  async ({ name, rate, currency, min_block_minutes, archived }) => {
    try {
      const client = await getClient();
      const project = await updateProject(client, name, { rate, currency, min_block_minutes, archived });
      const effective = {
        rate: await getEffectiveRate(client, project),
        currency: await getEffectiveCurrency(client, project),
        minBlock: await getEffectiveMinBlock(client, project),
      };
      return textResult(`Updated!\n${formatProject(project, effective)}`);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

server.tool(
  'project_list',
  'List all projects.',
  {
    include_archived: z.boolean().optional().describe('Include archived projects'),
  },
  async ({ include_archived }) => {
    try {
      const client = await getClient();
      const projects = await listProjects(client, include_archived);
      return textResult(formatProjectList(projects));
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

server.tool(
  'project_rename',
  'Rename a project.',
  {
    old_name: z.string().describe('Current project name'),
    new_name: z.string().describe('New project name'),
  },
  async ({ old_name, new_name }) => {
    try {
      const client = await getClient();
      const project = await renameProject(client, old_name, new_name);
      return textResult(`Project renamed to "${project.name}".`);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

server.tool(
  'project_delete',
  'Delete a project. Blocked if sessions exist unless force is true, in which case all sessions are permanently deleted.',
  {
    name: z.string().describe('Project name to delete'),
    force: z.boolean().optional().describe('Set to true to delete the project and all its sessions permanently'),
    dry_run: z.boolean().optional().describe('If true, returns the impact without making changes'),
    confirm_phrase: z.string().optional().describe('Required for execution. Exact phrase: DELETE PROJECT <name>'),
  },
  async ({ name, force, dry_run, confirm_phrase }) => {
    try {
      const client = await getClient();

      const impact = await getProjectDeleteImpact(client, name);
      if (dry_run) {
        return textResult(
          [
            `Dry run: project_delete`,
            `  Project: ${impact.project_name}`,
            `  Has active timer: ${impact.has_active_timer}`,
            `  Sessions: ${impact.sessions_count}`,
            `  Pauses: ${impact.pauses_count}`,
            `  Requires force: ${impact.requires_force}`,
            `To execute, send confirm_phrase: "DELETE PROJECT ${impact.project_name}"${impact.requires_force ? ' and force: true' : ''}.`,
          ].join('\n')
        );
      }

      const gate = requireConfirmation(dry_run, confirm_phrase, `DELETE PROJECT ${impact.project_name}`);
      if (!gate.allowed) {
        return errorResult(gate.message ?? 'Confirmation required.');
      }

      await deleteProject(client, name, { force });
      return textResult(`Project "${name}" deleted.`);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

server.tool(
  'project_merge',
  'Move all sessions from the source project into the target project, then delete the source project.',
  {
    source: z.string().describe('Name of the project to merge from (will be deleted)'),
    target: z.string().describe('Name of the project to merge into (kept)'),
    dry_run: z.boolean().optional().describe('If true, returns the impact without making changes'),
    confirm_phrase: z.string().optional().describe('Required for execution. Exact phrase: MERGE PROJECT <source> INTO <target>'),
  },
  async ({ source, target, dry_run, confirm_phrase }) => {
    try {
      const client = await getClient();

      const impact = await getProjectMergeImpact(client, source, target);
      if (dry_run) {
        return textResult(
          [
            `Dry run: project_merge`,
            `  Source: ${impact.source}`,
            `  Target: ${impact.target}`,
            `  Blocked by active timer: ${impact.blocked_by_active_timer}`,
            `  Sessions to move: ${impact.sessions_to_move}`,
            `To execute, send confirm_phrase: "MERGE PROJECT ${impact.source} INTO ${impact.target}".`,
          ].join('\n')
        );
      }

      const gate = requireConfirmation(dry_run, confirm_phrase, `MERGE PROJECT ${impact.source} INTO ${impact.target}`);
      if (!gate.allowed) {
        return errorResult(gate.message ?? 'Confirmation required.');
      }

      const result = await mergeProjects(client, source, target);
      return textResult(
        `Merged "${source}" into "${result.target.name}" (${result.sessionsMoved} session(s) moved).`
      );
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

// --- Billing/query tools ---

server.tool(
  'time_query',
  'Query time spent on projects with optional date range and project filters. Returns billing details.',
  {
    project: z.string().optional().describe('Filter by project name'),
    from: z.string().optional().describe('Start date (YYYY-MM-DD or ISO 8601)'),
    to: z.string().optional().describe('End date (YYYY-MM-DD or ISO 8601)'),
  },
  async ({ project, from, to }) => {
    try {
      const client = await getClient();
      const summary = await getBillingSummary(client, {
        projectName: project,
        from,
        to,
      });
      const output = [
        formatBillingRecords(summary.records),
        '',
        formatProjectTotals(summary.totals_by_project),
      ].join('\n');
      return textResult(output);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

server.tool(
  'billing_summary',
  'Calculate billing amounts with filters for unbilled or unpaid sessions.',
  {
    project: z.string().optional().describe('Filter by project name'),
    unbilled_only: z.boolean().optional().describe('Only show sessions not yet invoiced'),
    unpaid_only: z.boolean().optional().describe('Only show sessions not yet paid'),
  },
  async ({ project, unbilled_only, unpaid_only }) => {
    try {
      const client = await getClient();
      const summary = await getBillingSummary(client, {
        projectName: project,
        unbilledOnly: unbilled_only,
        unpaidOnly: unpaid_only,
      });
      const output = [
        formatBillingRecords(summary.records),
        '',
        formatProjectTotals(summary.totals_by_project),
      ].join('\n');
      return textResult(output);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

// --- Session tools ---

server.tool(
  'session_adjust',
  'Adjust the start and/or end time of a session. Supply times in local time (YYYY-MM-DDTHH:MM:SS); they are automatically converted to UTC for storage.',
  {
    session_id: positiveInteger.describe('Session ID to adjust'),
    start_time: z.string().optional().describe('New start time in local time (YYYY-MM-DDTHH:MM:SS)'),
    end_time: z.string().optional().describe('New end time in local time (YYYY-MM-DDTHH:MM:SS) — only valid for completed sessions'),
    dry_run: z.boolean().optional().describe('If true, previews UTC conversion and resulting values without writing'),
    confirm_phrase: z.string().optional().describe('Required for execution. Exact phrase: ADJUST SESSION <session_id>'),
  },
  async ({ session_id, start_time, end_time, dry_run, confirm_phrase }) => {
    try {
      const client = await getClient();
      const existing = await getSession(client, session_id);
      if (!existing) {
        return errorResult(`Session not found: ${session_id}`);
      }

      if (dry_run) {
        const previewStartUtc = start_time ? localDateTimeToUtcDb(start_time) : existing.start_time;
        const previewEndUtc = end_time ? localDateTimeToUtcDb(end_time) : existing.end_time;
        return textResult(
          [
            `Dry run: session_adjust`,
            `  Session: ${session_id}`,
            `  Current start (local): ${utcDbToLocal(existing.start_time)}`,
            `  Current end (local): ${existing.end_time ? utcDbToLocal(existing.end_time) : 'null'}`,
            `  Proposed start (local): ${utcDbToLocal(previewStartUtc)}`,
            `  Proposed end (local): ${previewEndUtc ? utcDbToLocal(previewEndUtc) : 'null'}`,
            `To execute, send confirm_phrase: "ADJUST SESSION ${session_id}".`,
          ].join('\n')
        );
      }

      const gate = requireConfirmation(dry_run, confirm_phrase, `ADJUST SESSION ${session_id}`);
      if (!gate.allowed) {
        return errorResult(gate.message ?? 'Confirmation required.');
      }

      const updated = await adjustSession(client, session_id, { start_time, end_time });
      const lines = [`Session #${updated.id} updated.`];
      lines.push(`  Start: ${utcDbToLocal(updated.start_time)}`);
      if (updated.end_time) lines.push(`  End:   ${utcDbToLocal(updated.end_time)}`);
      return textResult(lines.join('\n'));
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

// --- Invoice tools ---

server.tool(
  'mark_invoiced',
  'Mark completed sessions as invoiced.',
  {
    session_ids: z.array(positiveInteger).min(1).describe('Session IDs to mark as invoiced'),
    invoice_ref: z.string().optional().describe('Invoice reference number'),
  },
  async ({ session_ids, invoice_ref }) => {
    try {
      const client = await getClient();
      const count = await markInvoiced(client, session_ids, invoice_ref);
      return textResult(`Marked ${count} session(s) as invoiced.${invoice_ref ? ` Ref: ${invoice_ref}` : ''}`);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

server.tool(
  'mark_paid',
  'Mark completed sessions as paid.',
  {
    session_ids: z.array(positiveInteger).min(1).describe('Session IDs to mark as paid'),
  },
  async ({ session_ids }) => {
    try {
      const client = await getClient();
      const count = await markPaid(client, session_ids);
      return textResult(`Marked ${count} session(s) as paid.`);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

// --- Export tools ---

server.tool(
  'export_csv',
  'Export billing data as CSV text.',
  {
    project: z.string().optional().describe('Filter by project name'),
    from: z.string().optional().describe('Start date'),
    to: z.string().optional().describe('End date'),
  },
  async ({ project, from, to }) => {
    try {
      const client = await getClient();
      const csv = await exportCsv(client, { projectName: project, from, to });
      return textResult(csv);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

server.tool(
  'export_xlsx',
  'Export billing data as a formatted Excel workbook. Returns the file path.',
  {
    project: z.string().optional().describe('Filter by project name'),
    from: z.string().optional().describe('Start date'),
    to: z.string().optional().describe('End date'),
    output_path: z.string().describe('File path to write the .xlsx file to'),
  },
  async ({ project, from, to, output_path }) => {
    try {
      const client = await getClient();
      const buffer = await exportXlsx(client, { projectName: project, from, to });
      const { writeFileSync } = await import('node:fs');
      const safeOutputPath = resolveMcpOutputPath(output_path, '.xlsx');
      writeFileSync(safeOutputPath, buffer);
      return textResult(`Excel file written to: ${safeOutputPath}\nExport root: ${getMcpExportRoot()}`);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

server.tool(
  'export_preset',
  'Export billing data as CSV formatted for a specific accounting package.',
  {
    preset: z.enum(['quickbooks', 'xero', 'freshbooks', 'sage', 'myob']).describe('Target accounting software'),
    project: z.string().optional().describe('Filter by project name'),
    from: z.string().optional().describe('Start date'),
    to: z.string().optional().describe('End date'),
    output_path: z.string().optional().describe('File path to write the CSV (if omitted, returns content)'),
    account_code: z.string().optional().describe('Account code (Xero, Sage, MYOB)'),
    tax_type: z.string().optional().describe('Tax type (Xero, Sage)'),
    payment_terms_days: nonNegativeInteger.max(3650).optional().describe('Payment terms in days for DueDate (default 30)'),
  },
  async ({ preset, project, from, to, output_path, account_code, tax_type, payment_terms_days }) => {
    try {
      const client = await getClient();
      const csv = await exportPresetCsv(
        client,
        { projectName: project, from, to },
        preset,
        { accountCode: account_code, taxType: tax_type, paymentTermsDays: payment_terms_days }
      );
      if (output_path) {
        const { writeFileSync } = await import('node:fs');
        const safeOutputPath = resolveMcpOutputPath(output_path, '.csv');
        writeFileSync(safeOutputPath, csv);
        return textResult(`${preset} CSV written to: ${safeOutputPath}\nExport root: ${getMcpExportRoot()}`);
      }
      return textResult(csv);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

// --- Settings tool ---

server.tool(
  'settings_update',
  'View or update global default settings (default_rate, default_currency, default_min_block_minutes).',
  {
    key: z
      .enum(['default_rate', 'default_currency', 'default_min_block_minutes'])
      .optional()
      .describe('Setting key to update. Omit to view all settings.'),
    value: z.string().optional().describe('New value for the setting'),
  },
  async ({ key, value }) => {
    try {
      const client = await getClient();
      if (key && value) {
        await updateSetting(client, key as SettingKey, value);
        return textResult(`Setting "${key}" updated to "${value}".`);
      }
      const settings = await getSettings(client);
      return textResult(
        `Global Settings:\n  Default rate: ${settings.default_rate}/hr\n  Default currency: ${settings.default_currency}\n  Default min block: ${settings.default_min_block_minutes} minutes`
      );
    } catch (e) {
      return errorResult((e as Error).message);
    }
  }
);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Failed to start Work-Timer MCP server:', error);
  process.exit(1);
});
