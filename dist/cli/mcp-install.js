import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
function isJsonObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function createClaudeEntry(serverPath) {
    return {
        command: 'node',
        args: [serverPath],
    };
}
function createCopilotEntry(serverPath) {
    return {
        type: 'stdio',
        command: 'node',
        args: [serverPath],
    };
}
function asObjectProperty(root, key) {
    const existing = root[key];
    if (isJsonObject(existing)) {
        return existing;
    }
    const created = {};
    root[key] = created;
    return created;
}
function parseConfigJson(sourceText) {
    const trimmed = sourceText.trim();
    if (trimmed.length === 0) {
        return {};
    }
    try {
        return JSON.parse(trimmed);
    }
    catch {
        // Some MCP configs are edited as JSONC and commonly include trailing commas.
        const withoutTrailingCommas = trimmed.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(withoutTrailingCommas);
    }
}
export function upsertMcpServerConfig(input) {
    const parsed = parseConfigJson(input.sourceText);
    if (!isJsonObject(parsed)) {
        throw new Error('Config JSON root must be an object.');
    }
    if (input.schema === 'claude') {
        const mcpServers = asObjectProperty(parsed, 'mcpServers');
        const nextEntry = createClaudeEntry(input.serverPath);
        const currentEntry = mcpServers['work-timer'];
        if (JSON.stringify(currentEntry) === JSON.stringify(nextEntry)) {
            return { changed: false, outputText: JSON.stringify(parsed, null, 2) + '\n' };
        }
        mcpServers['work-timer'] = nextEntry;
        return { changed: true, outputText: JSON.stringify(parsed, null, 2) + '\n' };
    }
    const servers = asObjectProperty(parsed, 'servers');
    const nextEntry = createCopilotEntry(input.serverPath);
    const currentEntry = servers['work-timer'];
    if (JSON.stringify(currentEntry) === JSON.stringify(nextEntry)) {
        return { changed: false, outputText: JSON.stringify(parsed, null, 2) + '\n' };
    }
    servers['work-timer'] = nextEntry;
    return { changed: true, outputText: JSON.stringify(parsed, null, 2) + '\n' };
}
function getPathInfo(platform, env) {
    const home = env.HOME ?? homedir();
    if (platform === 'win32') {
        return {
            appData: env.APPDATA,
            configHome: env.APPDATA ?? join(home, 'AppData', 'Roaming'),
            home,
        };
    }
    if (platform === 'darwin') {
        return {
            configHome: join(home, 'Library', 'Application Support'),
            home,
        };
    }
    return {
        configHome: env.XDG_CONFIG_HOME ?? join(home, '.config'),
        home,
    };
}
export function discoverMcpTargets(params) {
    const platform = params?.platform ?? process.platform;
    const env = params?.env ?? process.env;
    const pathInfo = getPathInfo(platform, env);
    const claudePath = platform === 'win32' && pathInfo.appData
        ? join(pathInfo.appData, 'Claude', 'claude_desktop_config.json')
        : join(pathInfo.configHome, 'Claude', 'claude_desktop_config.json');
    const cursorPath = platform === 'win32' && pathInfo.appData
        ? join(pathInfo.appData, 'Cursor', 'User', 'mcp.json')
        : platform === 'darwin'
            ? join(pathInfo.configHome, 'Cursor', 'User', 'mcp.json')
            : join(pathInfo.home, '.cursor', 'mcp.json');
    const vscodePath = platform === 'win32' && pathInfo.appData
        ? join(pathInfo.appData, 'Code', 'User', 'mcp.json')
        : join(pathInfo.configHome, 'Code', 'User', 'mcp.json');
    const vscodeInsidersPath = platform === 'win32' && pathInfo.appData
        ? join(pathInfo.appData, 'Code - Insiders', 'User', 'mcp.json')
        : join(pathInfo.configHome, 'Code - Insiders', 'User', 'mcp.json');
    return [
        {
            id: 'claude-desktop',
            label: 'Claude Desktop',
            kind: 'json',
            configPath: claudePath,
            schema: 'claude',
            exists: existsSync(claudePath),
        },
        {
            id: 'cursor',
            label: 'Cursor',
            kind: 'json',
            configPath: cursorPath,
            schema: 'claude',
            exists: existsSync(cursorPath),
        },
        {
            id: 'vscode',
            label: 'VS Code (User MCP config)',
            kind: 'json',
            configPath: vscodePath,
            schema: 'copilot',
            exists: existsSync(vscodePath),
        },
        {
            id: 'vscode-insiders',
            label: 'VS Code Insiders (User MCP config)',
            kind: 'json',
            configPath: vscodeInsidersPath,
            schema: 'copilot',
            exists: existsSync(vscodeInsidersPath),
        },
        {
            id: 'claude-code',
            label: 'Claude Code CLI',
            kind: 'command',
            command: 'claude',
            args: ['mcp', 'add', 'work-timer', '--', 'node'],
        },
        {
            id: 'chatgpt-desktop',
            label: 'ChatGPT Desktop',
            kind: 'manual',
            notes: 'No stable local config file is documented for MCP connectors. Use Settings > Connectors > Create inside ChatGPT Desktop.',
        },
    ];
}
function timestampForBackup(now = new Date()) {
    const compact = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    return compact;
}
export function applyJsonMcpInstall(input) {
    const { target, serverPath, dryRun, createMissing } = input;
    if (!target.exists && !createMissing) {
        return {
            target,
            status: 'skipped-missing',
            message: `Config file not found: ${target.configPath}`,
        };
    }
    const sourceText = target.exists ? readFileSync(target.configPath, 'utf-8') : '{}\n';
    let updated;
    try {
        updated = upsertMcpServerConfig({
            sourceText,
            schema: target.schema,
            serverPath,
        });
    }
    catch (error) {
        return {
            target,
            status: 'error',
            message: `Invalid JSON at ${target.configPath}: ${error.message}`,
        };
    }
    if (!updated.changed) {
        return {
            target,
            status: 'unchanged',
            message: 'Existing work-timer entry is already up to date.',
        };
    }
    if (dryRun) {
        return {
            target,
            status: target.exists ? 'updated' : 'created',
            message: target.exists ? 'Would update config entry.' : 'Would create config and add entry.',
        };
    }
    let backupPath;
    if (target.exists) {
        backupPath = `${target.configPath}.bak.${timestampForBackup()}`;
        writeFileSync(backupPath, sourceText, 'utf-8');
    }
    else {
        mkdirSync(dirname(target.configPath), { recursive: true });
    }
    writeFileSync(target.configPath, updated.outputText, 'utf-8');
    return {
        target,
        status: target.exists ? 'updated' : 'created',
        message: target.exists ? 'Updated config entry.' : 'Created config and added entry.',
        backupPath,
    };
}
export function applyCommandMcpInstall(input) {
    const { target, serverPath, dryRun } = input;
    const fullArgs = [...target.args, serverPath];
    if (dryRun) {
        return {
            target,
            status: 'updated',
            message: `Would run: ${target.command} ${fullArgs.join(' ')}`,
        };
    }
    const result = spawnSync(target.command, fullArgs, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status === 0) {
        return {
            target,
            status: 'updated',
            message: 'Command completed successfully.',
        };
    }
    const stderr = (result.stderr ?? '').trim();
    const stdout = (result.stdout ?? '').trim();
    const output = [stderr, stdout].filter(Boolean).join(' | ');
    const lower = output.toLowerCase();
    if (lower.includes('already') && lower.includes('work-timer')) {
        return {
            target,
            status: 'unchanged',
            message: output || 'work-timer MCP entry already exists.',
        };
    }
    return {
        target,
        status: 'error',
        message: output || `Command failed with status ${String(result.status)}`,
    };
}
export function parseClientIds(input) {
    const items = input
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    const allowed = new Set([
        'claude-desktop',
        'cursor',
        'vscode',
        'vscode-insiders',
        'claude-code',
        'chatgpt-desktop',
    ]);
    for (const id of items) {
        if (!allowed.has(id)) {
            throw new Error(`Unknown client id: ${id}. Valid values: ${Array.from(allowed).join(', ')}`);
        }
    }
    return items;
}
//# sourceMappingURL=mcp-install.js.map