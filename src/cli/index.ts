#!/usr/bin/env node

import { Command } from 'commander';
import { getClient, loadConfig } from '../db/client.js';
import { startTimer, stopTimer, pauseTimer, resumeTimer, getRunningTimers } from '../core/timer.js';
import { createProject, updateProject, listProjects, getProjectByName } from '../core/projects.js';
import { getSettings, updateSetting, getEffectiveRate, getEffectiveCurrency, getEffectiveMinBlock } from '../core/settings.js';
import { getBillingSummary } from '../core/billing.js';
import { markInvoiced, markPaid } from '../core/sessions.js';
import { exportCsv, exportXlsx, exportPresetCsv } from '../core/export.js';
import { listPresetIds } from '../core/presets.js';
import {
  formatRunningTimers,
  formatBillingRecords,
  formatProjectTotals,
  formatProject,
  formatProjectList,
  formatDuration,
} from '../core/format.js';
import type { SettingKey } from '../types.js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

const program = new Command();

function parseNonNegativeNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative finite number.`);
  }
  return parsed;
}

function parseBoundedNonNegativeInteger(value: string, label: string, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
    throw new Error(`${label} must be an integer between 0 and ${max}.`);
  }
  return parsed;
}

function parsePositiveSessionIds(sessionIds: string[]): number[] {
  return sessionIds.map((id) => {
    const parsed = Number(id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`Invalid session ID: ${id}. Session IDs must be positive integers.`);
    }
    return parsed;
  });
}

program
  .name('work-timer')
  .description('Zero-cost work timer and billing tool for solo contractors')
  .version('1.1.1');

// --- Setup ---

program
  .command('setup')
  .description('Configure Work-Timer with your Turso database credentials')
  .action(async () => {
    let muteOutput = false;
    const mutedOutput = new Writable({
      write(chunk, _encoding, callback) {
        if (!muteOutput) {
          process.stdout.write(chunk);
        }
        callback();
      },
    });
    const rl = createInterface({ input: process.stdin, output: mutedOutput });

    const ask = (q: string): Promise<string> =>
      new Promise((resolve) => rl.question(q, resolve));
    const askSecret = (q: string): Promise<string> =>
      new Promise((resolve) => {
        process.stdout.write(q);
        muteOutput = true;
        rl.question('', (answer) => {
          muteOutput = false;
          process.stdout.write('\n');
          resolve(answer);
        });
      });

    console.log('Work-Timer Setup');
    console.log('================');
    console.log('');
    console.log('You need a free Turso account to store your data in the cloud.');
    console.log('1. Sign up at https://turso.tech (free tier: 9GB, 500M reads/mo)');
    console.log('2. Install the Turso CLI: curl -sSfL https://get.tur.so/install.sh | bash');
    console.log('3. Run: turso auth login');
    console.log('4. Run: turso db create work-timer');
    console.log('5. Run: turso db show work-timer --url   (copy the URL)');
    console.log('6. Run: turso db tokens create work-timer   (copy the token)');
    console.log('');

    const url = await ask('Turso database URL: ');
    const token = await askSecret('Turso auth token: ');

    if (!url || !token) {
      console.error('Both URL and token are required.');
      rl.close();
      process.exit(1);
    }

    const configDir = join(homedir(), '.work-timer');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true, mode: 0o700 });
    }

    const configPath = join(configDir, 'config.json');
    writeFileSync(
      configPath,
      JSON.stringify({ turso_url: url, turso_auth_token: token }, null, 2),
      { mode: 0o600 }
    );

    console.log(`\nConfig saved to ${configPath}`);
    console.log('Work-Timer is ready! Try: work-timer start my-project');
    rl.close();
  });

// --- Timer commands ---

program
  .command('start <project>')
  .description('Start a timer for a project')
  .option('--rate <number>', 'Billing rate per hour', (value: string) => parseNonNegativeNumber(value, 'Rate'))
  .option('--currency <code>', 'Currency code')
  .option('--notes <text>', 'Session notes')
  .action(async (project: string, opts: { rate?: number; currency?: string; notes?: string }) => {
    try {
      const client = await getClient();
      const session = await startTimer(client, project, opts);
      console.log(`Timer started for "${session.project_name}" (session #${session.id})`);
      console.log(`Started at: ${session.start_time}`);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

program
  .command('stop [project]')
  .description('Stop a running timer')
  .action(async (project?: string) => {
    try {
      const client = await getClient();
      const session = await stopTimer(client, project);
      const durationMs =
        new Date(session.end_time! + 'Z').getTime() - new Date(session.start_time + 'Z').getTime();
      console.log(`Timer stopped for "${session.project_name}" (session #${session.id})`);
      console.log(`Duration: ${formatDuration(durationMs / 60000)}`);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

program
  .command('pause [project]')
  .description('Pause a running timer')
  .action(async (project?: string) => {
    try {
      const client = await getClient();
      const session = await pauseTimer(client, project);
      console.log(`Timer paused for "${session.project_name}" (session #${session.id})`);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

program
  .command('resume [project]')
  .description('Resume a paused timer')
  .action(async (project?: string) => {
    try {
      const client = await getClient();
      const session = await resumeTimer(client, project);
      console.log(`Timer resumed for "${session.project_name}" (session #${session.id})`);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show all running/paused timers')
  .action(async () => {
    try {
      const client = await getClient();
      const timers = await getRunningTimers(client);
      console.log(formatRunningTimers(timers));
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

// --- Project commands ---

const projectCmd = program.command('project').description('Manage projects');

projectCmd
  .command('create <name>')
  .description('Create a new project')
  .option('--rate <number>', 'Billing rate per hour', (value: string) => parseNonNegativeNumber(value, 'Rate'))
  .option('--currency <code>', 'Currency code')
  .option('--min-block <minutes>', 'Minimum billing block in minutes', (value: string) =>
    parseBoundedNonNegativeInteger(value, 'Minimum billing block', 1440))
  .action(async (name: string, opts: { rate?: number; currency?: string; minBlock?: number }) => {
    try {
      const client = await getClient();
      const project = await createProject(client, name, {
        rate: opts.rate,
        currency: opts.currency,
        min_block_minutes: opts.minBlock,
      });
      const effective = {
        rate: await getEffectiveRate(client, project),
        currency: await getEffectiveCurrency(client, project),
        minBlock: await getEffectiveMinBlock(client, project),
      };
      console.log('Created!');
      console.log(formatProject(project, effective));
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

projectCmd
  .command('update <name>')
  .description('Update a project')
  .option('--rate <number>', 'Billing rate per hour', (value: string) => parseNonNegativeNumber(value, 'Rate'))
  .option('--currency <code>', 'Currency code')
  .option('--min-block <minutes>', 'Minimum billing block in minutes', (value: string) =>
    parseBoundedNonNegativeInteger(value, 'Minimum billing block', 1440))
  .option('--archive', 'Archive the project')
  .option('--unarchive', 'Unarchive the project')
  .action(
    async (
      name: string,
      opts: { rate?: number; currency?: string; minBlock?: number; archive?: boolean; unarchive?: boolean }
    ) => {
      try {
        const client = await getClient();
        const archived = opts.archive ? true : opts.unarchive ? false : undefined;
        const project = await updateProject(client, name, {
          rate: opts.rate,
          currency: opts.currency,
          min_block_minutes: opts.minBlock,
          archived,
        });
        const effective = {
          rate: await getEffectiveRate(client, project),
          currency: await getEffectiveCurrency(client, project),
          minBlock: await getEffectiveMinBlock(client, project),
        };
        console.log('Updated!');
        console.log(formatProject(project, effective));
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    }
  );

program
  .command('projects')
  .description('List all projects')
  .option('--all', 'Include archived projects')
  .action(async (opts: { all?: boolean }) => {
    try {
      const client = await getClient();
      const projects = await listProjects(client, opts.all);
      console.log(formatProjectList(projects));
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

// --- Query/billing commands ---

program
  .command('query [project]')
  .description('Query time and billing for a project')
  .option('--from <date>', 'Start date (YYYY-MM-DD)')
  .option('--to <date>', 'End date (YYYY-MM-DD)')
  .action(async (project: string | undefined, opts: { from?: string; to?: string }) => {
    try {
      const client = await getClient();
      const summary = await getBillingSummary(client, {
        projectName: project,
        from: opts.from,
        to: opts.to,
      });
      console.log(formatBillingRecords(summary.records));
      console.log('');
      console.log(formatProjectTotals(summary.totals_by_project));
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

program
  .command('summary')
  .description('Show billing summary')
  .option('--project <name>', 'Filter by project')
  .option('--unbilled', 'Only show unbilled sessions')
  .option('--unpaid', 'Only show unpaid sessions')
  .action(async (opts: { project?: string; unbilled?: boolean; unpaid?: boolean }) => {
    try {
      const client = await getClient();
      const summary = await getBillingSummary(client, {
        projectName: opts.project,
        unbilledOnly: opts.unbilled,
        unpaidOnly: opts.unpaid,
      });
      console.log(formatBillingRecords(summary.records));
      console.log('');
      console.log(formatProjectTotals(summary.totals_by_project));
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

// --- Invoice commands ---

program
  .command('invoice <session-ids...>')
  .description('Mark sessions as invoiced')
  .option('--ref <reference>', 'Invoice reference number')
  .action(async (sessionIds: string[], opts: { ref?: string }) => {
    try {
      const client = await getClient();
      const ids = parsePositiveSessionIds(sessionIds);
      const count = await markInvoiced(client, ids, opts.ref);
      console.log(`Marked ${count} session(s) as invoiced.${opts.ref ? ` Ref: ${opts.ref}` : ''}`);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

program
  .command('paid <session-ids...>')
  .description('Mark sessions as paid')
  .action(async (sessionIds: string[]) => {
    try {
      const client = await getClient();
      const ids = parsePositiveSessionIds(sessionIds);
      const count = await markPaid(client, ids);
      console.log(`Marked ${count} session(s) as paid.`);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

// --- Export ---

program
  .command('export')
  .description('Export billing data')
  .option('--project <name>', 'Filter by project')
  .option('--from <date>', 'Start date')
  .option('--to <date>', 'End date')
  .option('--output <file>', 'Output file path')
  .option('--format <fmt>', 'Format: csv or xlsx', 'csv')
  .option(`--preset <name>`, `Accounting preset: ${listPresetIds().join(', ')}`)
  .option('--account-code <code>', 'Account code (for Xero, Sage, MYOB presets)')
  .option('--tax-type <type>', 'Tax type (for Xero, Sage presets)')
  .option('--payment-terms <days>', 'Payment terms in days for DueDate calculation', (value: string) =>
    parseBoundedNonNegativeInteger(value, 'Payment terms', 3650))
  .action(
    async (opts: {
      project?: string; from?: string; to?: string; output?: string; format: string;
      preset?: string; accountCode?: string; taxType?: string; paymentTerms?: number;
    }) => {
      try {
        const client = await getClient();
        const filters = { projectName: opts.project, from: opts.from, to: opts.to };

        if (opts.preset) {
          const presetOptions = {
            accountCode: opts.accountCode,
            taxType: opts.taxType,
            paymentTermsDays: opts.paymentTerms,
          };
          const csv = await exportPresetCsv(client, filters, opts.preset, presetOptions);
          if (opts.output) {
            writeFileSync(opts.output, csv);
            console.log(`${opts.preset} CSV written to: ${opts.output}`);
          } else {
            console.log(csv);
          }
        } else if (opts.format === 'xlsx') {
          const buffer = await exportXlsx(client, filters);
          const outputPath = opts.output ?? 'billing-export.xlsx';
          writeFileSync(outputPath, buffer);
          console.log(`Excel file written to: ${outputPath}`);
        } else {
          const csv = await exportCsv(client, filters);
          if (opts.output) {
            writeFileSync(opts.output, csv);
            console.log(`CSV file written to: ${opts.output}`);
          } else {
            console.log(csv);
          }
        }
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    }
  );

// --- Config ---

const configCmd = program.command('config').description('Manage global settings');

configCmd
  .command('get [key]')
  .description('View settings')
  .action(async (key?: string) => {
    try {
      const client = await getClient();
      const settings = await getSettings(client);
      if (key) {
        const value = settings[key as keyof typeof settings];
        if (value === undefined) {
          console.error(`Unknown setting: ${key}`);
          process.exit(1);
        }
        console.log(`${key}: ${value}`);
      } else {
        console.log(`Default rate: ${settings.default_rate}/hr`);
        console.log(`Default currency: ${settings.default_currency}`);
        console.log(`Default min block: ${settings.default_min_block_minutes} minutes`);
      }
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

configCmd
  .command('set <key> <value>')
  .description('Update a setting')
  .action(async (key: string, value: string) => {
    try {
      const client = await getClient();
      await updateSetting(client, key as SettingKey, value);
      console.log(`Setting "${key}" updated to "${value}".`);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

program.parse();
