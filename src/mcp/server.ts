import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getClient } from '../db/client.js';
import { startTimer, stopTimer, pauseTimer, resumeTimer, getRunningTimers } from '../core/timer.js';
import { createProject, updateProject, listProjects, getProjectByName } from '../core/projects.js';
import { getSettings, updateSetting, getEffectiveRate, getEffectiveCurrency, getEffectiveMinBlock } from '../core/settings.js';
import { getBillingSummary } from '../core/billing.js';
import { markInvoiced, markPaid, querySessions } from '../core/sessions.js';
import { exportCsv, exportXlsx } from '../core/export.js';
import {
  formatRunningTimers,
  formatBillingRecords,
  formatProjectTotals,
  formatProject,
  formatProjectList,
  formatDuration,
} from '../core/format.js';
import type { SettingKey } from '../types.js';

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

const server = new McpServer({
  name: 'work-timer',
  version: '1.0.0',
});

// --- Timer tools ---

server.tool(
  'timer_start',
  'Start a timer for a project. Creates the project if it does not exist.',
  {
    project: z.string().describe('Project name'),
    rate: z.number().optional().describe('Billing rate per hour'),
    currency: z.string().optional().describe('Currency code (e.g. USD, EUR, GBP)'),
    notes: z.string().optional().describe('Notes for this session'),
  },
  async ({ project, rate, currency, notes }) => {
    try {
      const client = await getClient();
      const session = await startTimer(client, project, { rate, currency, notes });
      return textResult(
        `Timer started for "${session.project_name}" (session #${session.id})\nStarted at: ${session.start_time}`
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
    rate: z.number().optional().describe('Billing rate per hour'),
    currency: z.string().optional().describe('Currency code'),
    min_block_minutes: z.number().optional().describe('Minimum billing block in minutes'),
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
    rate: z.number().optional().describe('New billing rate per hour'),
    currency: z.string().optional().describe('New currency code'),
    min_block_minutes: z.number().optional().describe('New minimum billing block in minutes'),
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

// --- Invoice tools ---

server.tool(
  'mark_invoiced',
  'Mark completed sessions as invoiced.',
  {
    session_ids: z.array(z.number()).describe('Session IDs to mark as invoiced'),
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
    session_ids: z.array(z.number()).describe('Session IDs to mark as paid'),
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
      writeFileSync(output_path, buffer);
      return textResult(`Excel file written to: ${output_path}`);
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
