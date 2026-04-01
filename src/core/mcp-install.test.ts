import { describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyJsonMcpInstall,
  discoverMcpTargets,
  getManualInstallInstructions,
  getRecommendedLlmSystemPrompt,
  parseClientIds,
  upsertMcpServerConfig,
} from '../cli/mcp-install.js';

describe('upsertMcpServerConfig', () => {
  it('adds work-timer for Claude schema', () => {
    const result = upsertMcpServerConfig({
      sourceText: '{"mcpServers":{}}',
      schema: 'claude',
      serverPath: '/tmp/work-timer/dist/mcp/server.js',
    });

    expect(result.changed).toBe(true);
    const parsed = JSON.parse(result.outputText) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers['work-timer']).toEqual({
      command: 'node',
      args: ['/tmp/work-timer/dist/mcp/server.js'],
    });
  });

  it('adds work-timer for Copilot schema', () => {
    const result = upsertMcpServerConfig({
      sourceText: '{}',
      schema: 'copilot',
      serverPath: '/tmp/work-timer/dist/mcp/server.js',
    });

    expect(result.changed).toBe(true);
    const parsed = JSON.parse(result.outputText) as { servers: Record<string, unknown> };
    expect(parsed.servers['work-timer']).toEqual({
      type: 'stdio',
      command: 'node',
      args: ['/tmp/work-timer/dist/mcp/server.js'],
    });
  });

  it('is idempotent when entry already matches', () => {
    const source = JSON.stringify(
      {
        mcpServers: {
          'work-timer': {
            command: 'node',
            args: ['/tmp/work-timer/dist/mcp/server.js'],
          },
        },
      },
      null,
      2
    );

    const result = upsertMcpServerConfig({
      sourceText: source,
      schema: 'claude',
      serverPath: '/tmp/work-timer/dist/mcp/server.js',
    });

    expect(result.changed).toBe(false);
  });

  it('accepts JSON with trailing commas', () => {
    const result = upsertMcpServerConfig({
      sourceText: '{"mcpServers": {"existing": {"command": "node",},},}',
      schema: 'claude',
      serverPath: '/tmp/work-timer/dist/mcp/server.js',
    });

    expect(result.changed).toBe(true);
    const parsed = JSON.parse(result.outputText) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers['existing']).toEqual({ command: 'node' });
    expect(parsed.mcpServers['work-timer']).toEqual({
      command: 'node',
      args: ['/tmp/work-timer/dist/mcp/server.js'],
    });
  });
});

describe('parseClientIds', () => {
  it('parses comma-separated ids', () => {
    expect(parseClientIds('claude-desktop, cursor,vscode')).toEqual([
      'claude-desktop',
      'cursor',
      'vscode',
    ]);
  });

  it('rejects unknown ids', () => {
    expect(() => parseClientIds('not-real')).toThrow(/Unknown client id/);
  });
});

describe('discoverMcpTargets', () => {
  it('returns Windows target paths rooted in APPDATA', () => {
    const appData = join('C:', 'Users', 'alice', 'AppData', 'Roaming');
    const targets = discoverMcpTargets({
      platform: 'win32',
      env: { APPDATA: appData, HOME: join('C:', 'Users', 'alice') },
    });

    const claude = targets.find((t) => t.id === 'claude-desktop');
    expect(claude && claude.kind === 'json' ? claude.configPath : '').toContain(
      join('Claude', 'claude_desktop_config.json')
    );

    const vscode = targets.find((t) => t.id === 'vscode');
    expect(vscode && vscode.kind === 'json' ? vscode.configPath : '').toContain(
      join('Code', 'User', 'mcp.json')
    );
  });
});

describe('applyJsonMcpInstall', () => {
  it('creates a backup next to edited config files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'work-timer-mcp-'));
    const configPath = join(dir, 'mcp.json');
    const original = '{"servers":{}}\n';
    writeFileSync(configPath, original, 'utf-8');

    const result = applyJsonMcpInstall({
      target: {
        id: 'vscode',
        label: 'VS Code',
        kind: 'json',
        configPath,
        schema: 'copilot',
        exists: true,
      },
      serverPath: '/tmp/work-timer/dist/mcp/server.js',
      dryRun: false,
      createMissing: false,
    });

    expect(result.status).toBe('updated');
    expect(result.backupPath).toBeTruthy();
    expect(result.backupPath?.startsWith(configPath + '.bak.')).toBe(true);
    const backups = readdirSync(dir).filter((name) => name.startsWith('mcp.json.bak.'));
    expect(backups.length).toBe(1);
    expect(readFileSync(join(dir, backups[0]), 'utf-8')).toBe(original);
  });

  it('does not create a backup during dry-run', () => {
    const dir = mkdtempSync(join(tmpdir(), 'work-timer-mcp-'));
    const configPath = join(dir, 'mcp.json');
    writeFileSync(configPath, '{"servers":{}}\n', 'utf-8');

    const result = applyJsonMcpInstall({
      target: {
        id: 'vscode',
        label: 'VS Code',
        kind: 'json',
        configPath,
        schema: 'copilot',
        exists: true,
      },
      serverPath: '/tmp/work-timer/dist/mcp/server.js',
      dryRun: true,
      createMissing: false,
    });

    expect(result.status).toBe('updated');
    expect(result.backupPath).toBeUndefined();
    const backups = readdirSync(dir).filter((name) => name.startsWith('mcp.json.bak.'));
    expect(backups.length).toBe(0);
  });
});

describe('getManualInstallInstructions', () => {
  it('returns a non-empty recommended system prompt', () => {
    const prompt = getRecommendedLlmSystemPrompt();
    expect(prompt.toLowerCase()).toContain('work_timer_help');
  });

  it('returns JSON config instructions for file-based clients', () => {
    const instructions = getManualInstallInstructions(
      {
        id: 'vscode',
        label: 'VS Code',
        kind: 'json',
        configPath: '/tmp/mcp.json',
        schema: 'copilot',
        exists: false,
      },
      '/tmp/work-timer/dist/mcp/server.js'
    );

    expect(instructions[0]).toContain('/tmp/mcp.json');
    expect(instructions[1]).toContain('work-timer');
    expect(instructions[1]).toContain('/tmp/work-timer/dist/mcp/server.js');
    expect(instructions.some((line) => line.includes('work_timer_help'))).toBe(true);
  });

  it('returns command instructions for command-based clients', () => {
    const instructions = getManualInstallInstructions(
      {
        id: 'claude-code',
        label: 'Claude Code',
        kind: 'command',
        command: 'claude',
        args: ['mcp', 'add', 'work-timer', '--', 'node'],
      },
      '/tmp/work-timer/dist/mcp/server.js'
    );

    expect(instructions[0]).toContain('claude mcp add work-timer -- node /tmp/work-timer/dist/mcp/server.js');
  });
});
