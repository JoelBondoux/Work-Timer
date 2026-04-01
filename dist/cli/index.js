#!/usr/bin/env node
import { Command } from 'commander';
import { getClient } from '../db/client.js';
import { startTimer, stopTimer, pauseTimer, resumeTimer, getRunningTimers } from '../core/timer.js';
import { createProject, updateProject, listProjects, getProjectByName, findSimilarProjects, renameProject, deleteProject, mergeProjects } from '../core/projects.js';
import { getSettings, updateSetting, getEffectiveRate, getEffectiveCurrency, getEffectiveMinBlock } from '../core/settings.js';
import { getBillingSummary } from '../core/billing.js';
import { markInvoiced, markPaid, adjustSession } from '../core/sessions.js';
import { exportCsv, exportXlsx, exportPresetCsv } from '../core/export.js';
import { listPresetIds } from '../core/presets.js';
import { formatRunningTimers, formatBillingRecords, formatProjectTotals, formatProject, formatProjectList, formatDuration, } from '../core/format.js';
import { utcDbToLocal } from '../core/time.js';
import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { get } from 'node:https';
import { fileURLToPath } from 'node:url';
import { applyCommandMcpInstall, applyJsonMcpInstall, discoverMcpTargets, getManualInstallInstructions, getRecommendedLlmSystemPrompt, parseClientIds, upsertMcpServerConfig, } from './mcp-install.js';
function prompt(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}
const program = new Command();
const CLI_VERSION = '1.3.31';
const GITHUB_TARBALL_URL = 'https://codeload.github.com/JoelBondoux/Work-Timer/tar.gz/refs/heads/master';
const GITHUB_PACKAGE_JSON_URL = 'https://raw.githubusercontent.com/JoelBondoux/Work-Timer/master/package.json';
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
function printPostInstallQuickStart() {
    console.log('');
    console.log('Quick Start (Beginner Friendly)');
    console.log('===============================');
    console.log('1) Start timing work on a project:');
    console.log('   work-timer start "Client Alpha"');
    console.log('2) Check what is currently running:');
    console.log('   work-timer status');
    console.log('3) Stop timing when done:');
    console.log('   work-timer stop');
    console.log('4) Review logged time and totals:');
    console.log('   work-timer query');
    console.log('5) Optional: connect to local AI clients (MCP):');
    console.log('   work-timer mcp install --dry-run');
    console.log('   work-timer mcp install --create-missing');
}
function parseNonNegativeNumber(value, label) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${label} must be a non-negative finite number.`);
    }
    return parsed;
}
function parseBoundedNonNegativeInteger(value, label, max) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
        throw new Error(`${label} must be an integer between 0 and ${max}.`);
    }
    return parsed;
}
function parsePositiveSessionIds(sessionIds) {
    return sessionIds.map((id) => {
        const parsed = Number(id);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            throw new Error(`Invalid session ID: ${id}. Session IDs must be positive integers.`);
        }
        return parsed;
    });
}
function looksLikeWorkTimerRepo(repoPath) {
    const packageJsonPath = join(repoPath, 'package.json');
    if (!existsSync(packageJsonPath)) {
        return false;
    }
    try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        return pkg.name === 'work-timer';
    }
    catch {
        return false;
    }
}
function runNpm(args) {
    const spawnOptions = {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
    };
    // On Windows, try npm.cmd first, but fall back to bundled npm-cli.js if it fails
    const primaryNpm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const primary = spawnSync(primaryNpm, args, spawnOptions);
    const primaryError = primary.error;
    // If it succeeded (status is not null), return immediately
    if (primary.status !== null) {
        return {
            status: primary.status,
            stderr: primary.stderr ?? '',
            stdout: primary.stdout ?? '',
        };
    }
    // If it failed with ENOENT or EINVAL, try the fallback bundled npm-cli.js
    if (primaryError?.code === 'ENOENT' || primaryError?.code === 'EINVAL') {
        const nodeDir = dirname(process.execPath);
        const bundledNpmCli = join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js');
        if (existsSync(bundledNpmCli)) {
            const fallback = spawnSync(process.execPath, [bundledNpmCli, ...args], spawnOptions);
            return {
                status: fallback.status,
                stderr: fallback.stderr ?? '',
                stdout: fallback.stdout ?? '',
            };
        }
    }
    return {
        status: 1,
        stderr: primaryError?.message ?? 'npm executable not found',
        stdout: '',
    };
}
function getNpmGlobalPrefix() {
    const prefixResult = runNpm(['prefix', '-g']);
    if (prefixResult.status !== 0) {
        throw new Error(`npm prefix -g failed with status ${prefixResult.status}. stderr=[${prefixResult.stderr}] stdout=[${prefixResult.stdout}]`);
    }
    const output = prefixResult.stdout.trim().split(/\r?\n/).pop() ?? prefixResult.stdout.trim();
    if (!output) {
        throw new Error('npm prefix returned empty output');
    }
    return output;
}
function ensureWindowsNpmBinOnPath() {
    if (process.platform !== 'win32') {
        return null;
    }
    const npmBin = getNpmGlobalPrefix();
    // Ensure this process can immediately resolve freshly installed global binaries.
    const currentPathParts = (process.env.Path ?? '').split(';').map((p) => p.trim()).filter(Boolean);
    const inCurrentPath = currentPathParts.some((p) => p.toLowerCase() === npmBin.toLowerCase());
    if (!inCurrentPath) {
        process.env.Path = process.env.Path ? `${process.env.Path};${npmBin}` : npmBin;
    }
    const script = [
        `$npmBin = '${npmBin.replace(/'/g, "''")}'`,
        `$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')`,
        `$parts = @()`,
        `if ($userPath) { $parts = $userPath -split ';' | Where-Object { $_ -and $_.Trim() -ne '' } }`,
        `$exists = $false`,
        `foreach ($p in $parts) { if ($p.Trim().ToLowerInvariant() -eq $npmBin.ToLowerInvariant()) { $exists = $true; break } }`,
        `if (-not $exists) {`,
        `  $newPath = if ($parts.Count -gt 0) { ($parts + $npmBin) -join ';' } else { $npmBin }`,
        `  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')`,
        `  Write-Output 'ADDED'`,
        `} else {`,
        `  Write-Output 'EXISTS'`,
        `}`,
    ].join('; ');
    const psResult = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (psResult.status !== 0) {
        throw new Error(psResult.stderr.trim() || 'Failed to update user PATH');
    }
    const outcome = (psResult.stdout ?? '').trim().split(/\r?\n/).pop() ?? 'EXISTS';
    return { npmBin, addedToUserPath: outcome === 'ADDED' };
}
function getUpdateCheckCachePath() {
    return join(homedir(), '.work-timer', 'update-check.json');
}
function parseSemver(version) {
    const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
    if (!match)
        return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function isVersionNewer(latest, current) {
    const l = parseSemver(latest);
    const c = parseSemver(current);
    if (!l || !c)
        return false;
    if (l[0] !== c[0])
        return l[0] > c[0];
    if (l[1] !== c[1])
        return l[1] > c[1];
    return l[2] > c[2];
}
function readUpdateCheckCache() {
    try {
        const cachePath = getUpdateCheckCachePath();
        if (!existsSync(cachePath))
            return {};
        return JSON.parse(readFileSync(cachePath, 'utf-8'));
    }
    catch {
        return {};
    }
}
function writeUpdateCheckCache(cache) {
    const configDir = join(homedir(), '.work-timer');
    if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true, mode: 0o700 });
    }
    const cachePath = getUpdateCheckCachePath();
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), { mode: 0o600 });
}
function fetchText(url) {
    return new Promise((resolve, reject) => {
        const req = get(url, (res) => {
            const status = res.statusCode ?? 0;
            if (status < 200 || status >= 300) {
                reject(new Error(`HTTP ${status} from ${url}`));
                res.resume();
                return;
            }
            let data = '';
            res.setEncoding('utf-8');
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => {
            req.destroy(new Error('Request timed out'));
        });
    });
}
async function fetchLatestVersionFromGitHub() {
    try {
        const body = await fetchText(GITHUB_PACKAGE_JSON_URL);
        const pkg = JSON.parse(body);
        return typeof pkg.version === 'string' ? pkg.version : null;
    }
    catch {
        return null;
    }
}
function shouldAnnounceUpdateForCommand(argv) {
    if (argv.includes('--help') || argv.includes('-h') || argv.includes('--version') || argv.includes('-V')) {
        return false;
    }
    const firstArg = argv.find((arg) => !arg.startsWith('-'));
    if (!firstArg)
        return false;
    return firstArg === 'start' || firstArg === 'stop';
}
function performGlobalUpdate() {
    console.log('Starting Work-Timer update process...');
    console.log('Step 1/4: Checking npm global binary path configuration...');
    const pathFix = ensureWindowsNpmBinOnPath();
    if (pathFix?.addedToUserPath) {
        console.log(`Added npm global bin to user PATH: ${pathFix.npmBin}`);
        console.log('Open a new terminal after this command to use updated PATH in new sessions.');
    }
    else {
        console.log('npm global binary path looks good.');
    }
    console.log('Step 2/4: Installing latest Work-Timer package from GitHub...');
    const install = runNpm(['install', '-g', GITHUB_TARBALL_URL]);
    if (install.status !== 0) {
        const details = [install.stderr.trim(), install.stdout.trim()].filter(Boolean).join('\n');
        throw new Error(details || 'npm install failed');
    }
    console.log('Step 3/4: Resolving global npm install location...');
    const root = runNpm(['root', '-g']);
    if (root.status !== 0) {
        throw new Error(root.stderr.trim() || 'npm root failed');
    }
    const globalRoot = root.stdout.trim().split(/\r?\n/).pop() ?? root.stdout.trim();
    console.log('Step 4/4: Calculating installed MCP server path...');
    return join(globalRoot, 'work-timer', 'dist', 'mcp', 'server.js');
}
function getBundledMcpServerPath() {
    const currentFilePath = fileURLToPath(import.meta.url);
    return join(dirname(currentFilePath), '..', 'mcp', 'server.js');
}
function inspectInstallPath(pathToInspect) {
    const resolvedPath = resolve(pathToInspect);
    const exists = existsSync(resolvedPath);
    const hasGit = exists && existsSync(join(resolvedPath, '.git'));
    let originUrl;
    let dirty;
    let looksLikeWorkTimer = false;
    if (hasGit) {
        looksLikeWorkTimer = looksLikeWorkTimerRepo(resolvedPath);
        const originResult = spawnSync('git', ['-C', resolvedPath, 'remote', 'get-url', 'origin'], {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        if (originResult.status === 0) {
            originUrl = (originResult.stdout ?? '').trim();
        }
        const statusResult = spawnSync('git', ['-C', resolvedPath, 'status', '--porcelain'], {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        if (statusResult.status === 0) {
            dirty = (statusResult.stdout ?? '').trim().length > 0;
        }
    }
    return {
        path: resolvedPath,
        exists,
        hasGit,
        looksLikeWorkTimer,
        originUrl,
        dirty,
    };
}
async function maybeAnnounceUpdate(argv) {
    if (process.env.WORK_TIMER_DISABLE_UPDATE_CHECK === '1')
        return;
    if (process.env.CI === 'true')
        return;
    if (!shouldAnnounceUpdateForCommand(argv))
        return;
    const cache = readUpdateCheckCache();
    const now = Date.now();
    const lastChecked = cache.lastCheckedAt ? Date.parse(cache.lastCheckedAt) : 0;
    const shouldRefresh = !lastChecked || Number.isNaN(lastChecked) || now - lastChecked > UPDATE_CHECK_INTERVAL_MS;
    let latestVersion = cache.latestVersion;
    if (shouldRefresh) {
        const fetchedVersion = await fetchLatestVersionFromGitHub();
        latestVersion = fetchedVersion ?? cache.latestVersion;
        writeUpdateCheckCache({
            lastCheckedAt: new Date(now).toISOString(),
            latestVersion,
        });
    }
    if (!latestVersion || !isVersionNewer(latestVersion, CLI_VERSION)) {
        return;
    }
    if (cache.dismissedVersion === latestVersion) {
        return;
    }
    console.log(`A new Work-Timer build is available: ${latestVersion} (current: ${CLI_VERSION}).`);
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.log('Run `work-timer update` to install it.');
        return;
    }
    const answer = await prompt('Update now? [y/N]: ');
    if (!/^y(es)?$/i.test(answer.trim())) {
        console.log('Skipped update. You can run `work-timer update` at any time.');
        writeUpdateCheckCache({
            lastCheckedAt: cache.lastCheckedAt ?? new Date(now).toISOString(),
            latestVersion,
            dismissedVersion: latestVersion,
        });
        return;
    }
    try {
        const mcpPath = performGlobalUpdate();
        console.log('Update complete.');
        console.log(`MCP server path: ${mcpPath}`);
        console.log('If your MCP client uses a hardcoded path, update it to this location.');
    }
    catch (e) {
        console.error(`Update failed: ${e.message}`);
    }
}
program
    .name('work-timer')
    .description('Zero-cost work timer and billing tool for solo contractors')
    .version(CLI_VERSION);
program
    .command('update')
    .description('Update Work-Timer (including MCP server) to the latest version from GitHub')
    .action(() => {
    try {
        const mcpPath = performGlobalUpdate();
        console.log('Update complete.');
        console.log(`MCP server path: ${mcpPath}`);
        console.log('If your MCP client uses a hardcoded path, update it to this location.');
    }
    catch (e) {
        console.error(`Update failed: ${e.message}`);
        process.exit(1);
    }
});
const doctorCmd = program.command('doctor').description('Inspect local Work-Timer installation state');
doctorCmd
    .command('install-path')
    .description('Show install-path diagnostics and suggested next action')
    .option('--path <path>', 'Path to inspect (defaults to ~/Work-Timer)')
    .action((opts) => {
    try {
        const inspectPath = opts.path ?? join(homedir(), 'Work-Timer');
        const info = inspectInstallPath(inspectPath);
        console.log('Install path diagnostics:');
        console.log(`- path: ${info.path}`);
        console.log(`- exists: ${info.exists ? 'yes' : 'no'}`);
        console.log(`- git repository: ${info.hasGit ? 'yes' : 'no'}`);
        console.log(`- looks like Work-Timer install: ${info.looksLikeWorkTimer ? 'yes' : 'no'}`);
        if (info.originUrl) {
            console.log(`- git origin: ${info.originUrl}`);
        }
        if (typeof info.dirty === 'boolean') {
            console.log(`- uncommitted changes: ${info.dirty ? 'yes' : 'no'}`);
        }
        console.log('');
        console.log('Suggested installer behavior:');
        if (!info.exists) {
            console.log('- Fresh install into this path.');
        }
        else if (!info.hasGit || !info.looksLikeWorkTimer) {
            console.log('- Existing folder will be backed up with a timestamped suffix, then Work-Timer will install into this path.');
        }
        else if (info.dirty) {
            console.log('- Installer will stop by default because this install has local changes.');
            console.log('- Use WORK_TIMER_ALLOW_DIRTY=1 only if you intentionally want to proceed.');
        }
        else {
            console.log('- Existing Work-Timer install will be updated in place.');
            console.log('- If the version is already current, installer will ask whether to repair or cancel.');
        }
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
program
    .command('uninstall')
    .description('Uninstall Work-Timer from the global npm location')
    .option('--yes', 'Skip confirmation prompt')
    .option('--purge-local <path>', 'Also delete a local Work-Timer source folder after uninstall')
    .action(async (opts) => {
    try {
        if (!opts.yes && process.stdin.isTTY && process.stdout.isTTY) {
            const answer = await prompt('Uninstall Work-Timer globally? [y/N]: ');
            if (!/^y(es)?$/i.test(answer.trim())) {
                console.log('Aborted.');
                return;
            }
        }
        const uninstall = runNpm(['uninstall', '-g', 'work-timer']);
        if (uninstall.status !== 0) {
            const details = [uninstall.stderr.trim(), uninstall.stdout.trim()].filter(Boolean).join('\n');
            throw new Error(details || 'npm uninstall failed');
        }
        console.log('Work-Timer has been uninstalled from global npm packages.');
        console.log('If this terminal still resolves `work-timer`, open a new terminal session.');
        if (opts.purgeLocal) {
            const localPath = resolve(opts.purgeLocal);
            if (!existsSync(localPath)) {
                throw new Error(`Local path not found: ${localPath}`);
            }
            if (!statSync(localPath).isDirectory()) {
                throw new Error(`Local path is not a directory: ${localPath}`);
            }
            if (!looksLikeWorkTimerRepo(localPath)) {
                throw new Error(`Refusing to delete "${localPath}" because it does not look like a Work-Timer repository (missing package.json name=work-timer).`);
            }
            const cwd = resolve(process.cwd()).toLowerCase();
            const localLower = localPath.toLowerCase();
            if (cwd === localLower || cwd.startsWith(localLower + '\\')) {
                throw new Error(`Cannot purge the current working directory (${localPath}). Change directories and run uninstall again.`);
            }
            if (!opts.yes && process.stdin.isTTY && process.stdout.isTTY) {
                const confirm = await prompt(`Delete local source folder "${localPath}"? Type "delete" to confirm: `);
                if (confirm.trim().toLowerCase() !== 'delete') {
                    console.log('Skipped local folder deletion.');
                    return;
                }
            }
            else if (!opts.yes) {
                console.log('Skipping local folder deletion because confirmation is not possible in non-interactive mode.');
                return;
            }
            rmSync(localPath, { recursive: true, force: false });
            console.log(`Deleted local source folder: ${localPath}`);
        }
    }
    catch (e) {
        console.error(`Uninstall failed: ${e.message}`);
        process.exit(1);
    }
});
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
    const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
    const askSecret = (q) => new Promise((resolve) => {
        process.stdout.write(q);
        muteOutput = true;
        rl.question('', (answer) => {
            muteOutput = false;
            process.stdout.write('\n');
            resolve(answer);
        });
    });
    console.log('Work-Timer Guided Setup');
    console.log('================');
    console.log('');
    console.log('This guided flow will:');
    console.log('- collect your Turso database URL and token');
    console.log('- save them to your local Work-Timer config');
    console.log('- show exactly what to run next');
    console.log('');
    console.log('You need a free Turso account to store your data in the cloud.');
    console.log('1. Sign up at https://turso.tech (free tier: 9GB, 500M reads/mo)');
    console.log('2. Install the Turso CLI: curl -sSfL https://get.tur.so/install.sh | bash');
    console.log('3. Run: turso auth login');
    console.log('4. Run: turso db create work-timer');
    console.log('5. Run: turso db show work-timer --url   (copy the URL)');
    console.log('6. Run: turso db tokens create work-timer   (copy the token)');
    console.log('');
    console.log('Step 1/3: Collect credentials.');
    const url = await ask('Turso database URL (example: libsql://your-db.turso.io): ');
    const token = await askSecret('Turso auth token (input is hidden): ');
    if (!url || !token) {
        console.error('Both URL and token are required.');
        rl.close();
        process.exit(1);
    }
    console.log('Step 2/3: Preparing config directory...');
    const configDir = join(homedir(), '.work-timer');
    if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true, mode: 0o700 });
        console.log(`Created directory: ${configDir}`);
    }
    else {
        console.log(`Using existing directory: ${configDir}`);
    }
    console.log('Step 3/3: Writing credentials to config file...');
    const configPath = join(configDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ turso_url: url, turso_auth_token: token }, null, 2), { mode: 0o600 });
    console.log(`\nConfig saved to ${configPath}`);
    console.log('Setup complete. Work-Timer is now ready to use.');
    printPostInstallQuickStart();
    rl.close();
});
// --- MCP client installation ---
const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};
function supportsColor() {
    return Boolean(process.stdout.isTTY && process.env.NO_COLOR !== '1' && process.env.NO_COLOR !== 'true');
}
function colorize(text, colorCode) {
    if (!colorCode || !supportsColor()) {
        return text;
    }
    return `${colorCode}${text}${ANSI.reset}`;
}
function stripAnsi(text) {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
}
function wrapText(text, width) {
    const rawLines = text.split(/\r?\n/);
    const wrapped = [];
    for (const rawLine of rawLines) {
        const line = rawLine.trimEnd();
        if (line.length <= width) {
            wrapped.push(line);
            continue;
        }
        const leading = (line.match(/^\s*/) ?? [''])[0];
        const content = line.trimStart();
        const contentWidth = Math.max(10, width - leading.length);
        const words = content.split(/\s+/);
        let current = '';
        for (const word of words) {
            if (!current) {
                current = word;
                continue;
            }
            if (`${current} ${word}`.length <= contentWidth) {
                current = `${current} ${word}`;
            }
            else {
                wrapped.push(`${leading}${current}`);
                current = word;
            }
        }
        if (current) {
            wrapped.push(`${leading}${current}`);
        }
    }
    return wrapped.length > 0 ? wrapped : [''];
}
function padRight(text, width) {
    const visible = stripAnsi(text).length;
    if (visible >= width) {
        return text;
    }
    return `${text}${' '.repeat(width - visible)}`;
}
function printPanel(title, bodyLines, tone = ANSI.cyan) {
    const maxWidth = Math.max(76, Math.min(process.stdout.columns ?? 100, 120));
    const innerWidth = maxWidth - 4;
    const topBorder = colorize(`+${'-'.repeat(maxWidth - 2)}+`, tone);
    console.log(topBorder);
    console.log(colorize(`| ${padRight(colorize(title, ANSI.bold), innerWidth)} |`, tone));
    console.log(colorize(`+${'-'.repeat(maxWidth - 2)}+`, tone));
    for (const line of bodyLines) {
        const wrapped = wrapText(line, innerWidth);
        for (const chunk of wrapped) {
            console.log(`| ${padRight(chunk, innerWidth)} |`);
        }
    }
    console.log(topBorder);
}
function statusTag(status) {
    switch (status) {
        case 'updated':
        case 'created':
            return colorize('[UPDATED]', ANSI.green);
        case 'unchanged':
            return colorize('[UNCHANGED]', ANSI.blue);
        case 'skipped-missing':
        case 'skipped-manual':
            return colorize('[SKIPPED]', ANSI.yellow);
        case 'error':
            return colorize('[ERROR]', ANSI.red);
        default:
            return colorize('[INFO]', ANSI.cyan);
    }
}
function printSeparator(label) {
    const width = Math.max(76, Math.min(process.stdout.columns ?? 100, 120));
    if (!label) {
        console.log(colorize('-'.repeat(width), ANSI.dim));
        return;
    }
    const prefix = ` ${label} `;
    const rest = Math.max(0, width - prefix.length);
    console.log(colorize(`${prefix}${'-'.repeat(rest)}`, ANSI.dim));
}
function formatManualSteps(steps) {
    const lines = [];
    lines.push(colorize('Manual follow-up:', ANSI.bold));
    for (let i = 0; i < steps.length; i += 1) {
        const stepLines = steps[i].split(/\r?\n/);
        lines.push(`  ${i + 1}. ${stepLines[0]}`);
        for (const extra of stepLines.slice(1)) {
            lines.push(`     ${extra}`);
        }
    }
    return lines;
}
const mcpCmd = program.command('mcp').description('Manage MCP client registrations');
mcpCmd
    .command('list')
    .description('List known MCP clients and whether their local config is detected')
    .action(() => {
    const targets = discoverMcpTargets();
    console.log('Known MCP client targets:');
    for (const target of targets) {
        if (target.kind === 'json') {
            console.log(`- ${target.id}: ${target.label} (${target.exists ? 'detected' : 'not found'})`);
            console.log(`  path: ${target.configPath}`);
        }
        else if (target.kind === 'command') {
            console.log(`- ${target.id}: ${target.label} (command-based)`);
        }
        else {
            console.log(`- ${target.id}: ${target.label} (manual setup)`);
        }
    }
});
mcpCmd
    .command('doctor')
    .description('Diagnose MCP setup and print actionable fixes for local clients')
    .option('--clients <ids>', 'Comma-separated client ids: claude-desktop,cursor,vscode,vscode-insiders,claude-code,codex-cli,gemini-cli,chatgpt-desktop')
    .option('--server-path <path>', 'Absolute path to MCP server.js (defaults to this Work-Timer install)')
    .action((opts) => {
    try {
        const serverPath = opts.serverPath ?? getBundledMcpServerPath();
        const requestedIds = opts.clients ? parseClientIds(opts.clients) : null;
        const targets = discoverMcpTargets().filter((target) => requestedIds ? requestedIds.includes(target.id) : true);
        if (targets.length === 0) {
            console.log('No matching MCP clients selected.');
            return;
        }
        console.log('Running MCP diagnostics...');
        console.log(`Using MCP server path: ${serverPath}`);
        const serverExists = existsSync(serverPath);
        console.log(`- server-path: ${serverExists ? 'ok' : 'error'}`);
        if (!serverExists) {
            console.log('  MCP server file was not found at this path.');
            console.log('  Fix: run `work-timer update` or pass --server-path with a valid dist/mcp/server.js path.');
        }
        let okCount = 0;
        let warnCount = 0;
        let errorCount = 0;
        for (const target of targets) {
            if (target.kind === 'json') {
                if (!target.exists) {
                    warnCount += 1;
                    console.log(`- ${target.id}: warn`);
                    console.log(`  Config not found: ${target.configPath}`);
                    console.log(`  Fix: run \`work-timer mcp install --clients ${target.id} --create-missing\` and restart the client.`);
                    continue;
                }
                try {
                    const sourceText = readFileSync(target.configPath, 'utf-8');
                    const check = upsertMcpServerConfig({
                        sourceText,
                        schema: target.schema,
                        serverPath,
                    });
                    if (check.changed) {
                        warnCount += 1;
                        console.log(`- ${target.id}: warn`);
                        console.log('  work-timer entry is missing or out of date in this config.');
                        console.log(`  Fix: run \`work-timer mcp install --clients ${target.id}\` and restart the client.`);
                    }
                    else {
                        okCount += 1;
                        console.log(`- ${target.id}: ok`);
                        console.log('  work-timer MCP entry is present and up to date.');
                    }
                }
                catch (error) {
                    errorCount += 1;
                    console.log(`- ${target.id}: error`);
                    console.log(`  Could not read/parse config: ${target.configPath}`);
                    console.log(`  Details: ${error.message}`);
                    console.log('  Fix: repair JSON and rerun `work-timer mcp install` or apply manual setup instructions.');
                }
                continue;
            }
            if (target.kind === 'command') {
                const result = spawnSync(target.command, ['--version'], {
                    encoding: 'utf-8',
                    stdio: ['ignore', 'pipe', 'pipe'],
                });
                if (result.status === 0) {
                    okCount += 1;
                    console.log(`- ${target.id}: ok`);
                    console.log('  Client CLI command is available on PATH.');
                }
                else {
                    warnCount += 1;
                    console.log(`- ${target.id}: warn`);
                    console.log('  Client CLI command was not detected on PATH.');
                    console.log(`  Fix: install/update the client CLI, then run \`work-timer mcp install --clients ${target.id}\`.`);
                }
                continue;
            }
            warnCount += 1;
            console.log(`- ${target.id}: warn`);
            console.log('  This client uses manual MCP setup.');
            console.log(`  Note: ${target.notes}`);
        }
        if (!serverExists) {
            errorCount += 1;
        }
        console.log('');
        console.log('MCP doctor summary:');
        console.log(`- ok: ${okCount}`);
        console.log(`- warnings: ${warnCount}`);
        console.log(`- errors: ${errorCount}`);
        if (errorCount > 0) {
            process.exit(1);
        }
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
mcpCmd
    .command('install')
    .description('Install or update Work-Timer MCP registration in supported local client configs')
    .option('--clients <ids>', 'Comma-separated client ids: claude-desktop,cursor,vscode,vscode-insiders,claude-code,codex-cli,gemini-cli,chatgpt-desktop')
    .option('--server-path <path>', 'Absolute path to MCP server.js (defaults to this Work-Timer install)')
    .option('--create-missing', 'Create missing JSON config files/directories for supported clients')
    .option('--dry-run', 'Preview changes without writing files or running commands')
    .action((opts) => {
    try {
        const serverPath = opts.serverPath ?? getBundledMcpServerPath();
        const requestedIds = opts.clients ? parseClientIds(opts.clients) : null;
        const targets = discoverMcpTargets().filter((target) => requestedIds ? requestedIds.includes(target.id) : true);
        if (targets.length === 0) {
            console.log('No matching MCP clients selected.');
            return;
        }
        printPanel('WORK-TIMER MCP INSTALLER', [
            `Mode: ${opts.dryRun ? 'Dry run (no files written)' : 'Apply changes'}`,
            `Targets detected: ${targets.length}`,
            `MCP server path: ${serverPath}`,
        ]);
        const results = targets.map((target) => {
            if (target.kind === 'json') {
                return applyJsonMcpInstall({
                    target,
                    serverPath,
                    dryRun: Boolean(opts.dryRun),
                    createMissing: Boolean(opts.createMissing),
                });
            }
            if (target.kind === 'command') {
                return applyCommandMcpInstall({
                    target,
                    serverPath,
                    dryRun: Boolean(opts.dryRun),
                });
            }
            return {
                target,
                status: 'skipped-manual',
                message: target.notes,
            };
        });
        printSeparator('Results');
        for (const result of results) {
            const body = [];
            body.push(`Client: ${result.target.label} (${result.target.id})`);
            body.push(`Outcome: ${result.message}`);
            if (result.backupPath) {
                body.push(`Backup: ${result.backupPath}`);
            }
            if (result.status === 'error' || result.status === 'skipped-missing') {
                body.push('');
                body.push(...formatManualSteps(getManualInstallInstructions(result.target, serverPath)));
            }
            const tone = result.status === 'error'
                ? ANSI.red
                : result.status === 'updated' || result.status === 'created'
                    ? ANSI.green
                    : result.status === 'unchanged'
                        ? ANSI.blue
                        : ANSI.yellow;
            printPanel(`${statusTag(result.status)} ${result.target.id}`, body, tone);
        }
        const updatedCount = results.filter((result) => result.status === 'updated' || result.status === 'created').length;
        const unchangedCount = results.filter((result) => result.status === 'unchanged').length;
        const skippedCount = results.filter((result) => result.status === 'skipped-missing' || result.status === 'skipped-manual').length;
        const errorCount = results.filter((result) => result.status === 'error').length;
        printSeparator('Summary');
        printPanel('MCP INSTALLATION SUMMARY', [
            `Updated or created: ${updatedCount}`,
            `Unchanged: ${unchangedCount}`,
            `Skipped: ${skippedCount}`,
            `Errors: ${errorCount}`,
        ], errorCount > 0 ? ANSI.red : ANSI.green);
        if (skippedCount > 0 && !opts.createMissing) {
            printPanel('TIP', [
                'Some clients were skipped because config files were missing.',
                'Re-run with --create-missing to create missing JSON configs automatically.',
            ], ANSI.yellow);
        }
        if (errorCount === 0) {
            console.log(colorize('Done. If a client was updated, restart that client to load new MCP settings.', ANSI.green));
        }
        printPanel('RECOMMENDED CLIENT SYSTEM PROMPT', [getRecommendedLlmSystemPrompt()], ANSI.cyan);
        const errors = results.filter((result) => result.status === 'error');
        if (errors.length > 0) {
            process.exit(1);
        }
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
// --- Timer commands ---
program
    .command('start <project>')
    .description('Start a timer for a project')
    .option('--rate <number>', 'Billing rate per hour', (value) => parseNonNegativeNumber(value, 'Rate'))
    .option('--currency <code>', 'Currency code')
    .option('--notes <text>', 'Session notes')
    .action(async (project, opts) => {
    try {
        const client = await getClient();
        // Similarity check: only runs when the exact name doesn't already exist
        const exact = await getProjectByName(client, project);
        if (!exact) {
            const similar = await findSimilarProjects(client, project);
            if (similar.length > 0) {
                console.log(`No project named "${project}" found. Did you mean one of these?`);
                similar.forEach((p, i) => console.log(`  ${i + 1}. ${p.name}`));
                console.log(`  ${similar.length + 1}. Create new project "${project}"`);
                const answer = await prompt(`Choose [1-${similar.length + 1}]: `);
                const choice = parseInt(answer.trim(), 10);
                if (choice >= 1 && choice <= similar.length) {
                    project = similar[choice - 1].name;
                }
                else if (choice !== similar.length + 1) {
                    console.error('Invalid choice. Aborting.');
                    process.exit(1);
                }
            }
        }
        const session = await startTimer(client, project, opts);
        console.log(`Timer started for "${session.project_name}" (session #${session.id})`);
        console.log(`Started at: ${utcDbToLocal(session.start_time)}`);
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
program
    .command('stop [project]')
    .description('Stop a running timer')
    .action(async (project) => {
    try {
        const client = await getClient();
        const session = await stopTimer(client, project);
        const durationMs = new Date(session.end_time + 'Z').getTime() - new Date(session.start_time + 'Z').getTime();
        console.log(`Timer stopped for "${session.project_name}" (session #${session.id})`);
        console.log(`Duration: ${formatDuration(durationMs / 60000)}`);
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
program
    .command('pause [project]')
    .description('Pause a running timer')
    .action(async (project) => {
    try {
        const client = await getClient();
        const session = await pauseTimer(client, project);
        console.log(`Timer paused for "${session.project_name}" (session #${session.id})`);
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
program
    .command('resume [project]')
    .description('Resume a paused timer')
    .action(async (project) => {
    try {
        const client = await getClient();
        const session = await resumeTimer(client, project);
        console.log(`Timer resumed for "${session.project_name}" (session #${session.id})`);
    }
    catch (e) {
        console.error(e.message);
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
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
// --- Project commands ---
const projectCmd = program.command('project').description('Manage projects');
projectCmd
    .command('create <name>')
    .description('Create a new project')
    .option('--rate <number>', 'Billing rate per hour', (value) => parseNonNegativeNumber(value, 'Rate'))
    .option('--currency <code>', 'Currency code')
    .option('--min-block <minutes>', 'Minimum billing block in minutes', (value) => parseBoundedNonNegativeInteger(value, 'Minimum billing block', 1440))
    .action(async (name, opts) => {
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
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
projectCmd
    .command('update <name>')
    .description('Update a project')
    .option('--rate <number>', 'Billing rate per hour', (value) => parseNonNegativeNumber(value, 'Rate'))
    .option('--currency <code>', 'Currency code')
    .option('--min-block <minutes>', 'Minimum billing block in minutes', (value) => parseBoundedNonNegativeInteger(value, 'Minimum billing block', 1440))
    .option('--archive', 'Archive the project')
    .option('--unarchive', 'Unarchive the project')
    .action(async (name, opts) => {
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
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
projectCmd
    .command('rename <old-name> <new-name>')
    .description('Rename a project')
    .action(async (oldName, newName) => {
    try {
        const client = await getClient();
        const project = await renameProject(client, oldName, newName);
        console.log(`Project renamed to "${project.name}".`);
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
projectCmd
    .command('delete <name>')
    .description('Delete a project. Blocked if sessions exist unless --force is passed.')
    .option('--force', 'Delete the project and all its sessions permanently')
    .action(async (name, opts) => {
    try {
        const client = await getClient();
        if (opts.force) {
            const answer = await prompt(`Permanently delete "${name}" and all its sessions? Type "yes" to confirm: `);
            if (answer.trim().toLowerCase() !== 'yes') {
                console.log('Aborted.');
                return;
            }
        }
        await deleteProject(client, name, { force: opts.force });
        console.log(`Project "${name}" deleted.`);
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
projectCmd
    .command('merge <source> <target>')
    .description('Move all sessions from source project into target project, then delete source')
    .action(async (source, target) => {
    try {
        const client = await getClient();
        const answer = await prompt(`Merge "${source}" into "${target}"? This will delete "${source}". Type "yes" to confirm: `);
        if (answer.trim().toLowerCase() !== 'yes') {
            console.log('Aborted.');
            return;
        }
        const result = await mergeProjects(client, source, target);
        console.log(`Merged "${source}" into "${result.target.name}" (${result.sessionsMoved} session(s) moved).`);
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
program
    .command('projects')
    .description('List all projects')
    .option('--all', 'Include archived projects')
    .action(async (opts) => {
    try {
        const client = await getClient();
        const projects = await listProjects(client, opts.all);
        console.log(formatProjectList(projects));
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
// --- Query/billing commands ---
program
    .command('query [project]')
    .description('Query time and billing for a project')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .action(async (project, opts) => {
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
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
program
    .command('summary')
    .description('Show billing summary')
    .option('--project <name>', 'Filter by project')
    .option('--unbilled', 'Only show unbilled sessions')
    .option('--unpaid', 'Only show unpaid sessions')
    .action(async (opts) => {
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
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
// --- Session commands ---
const sessionCmd = program.command('session').description('Manage sessions');
sessionCmd
    .command('adjust <session-id>')
    .description('Adjust the start and/or end time of a session. Times must be in local time (YYYY-MM-DDTHH:MM:SS).')
    .option('--start <datetime>', 'New start time in local time (YYYY-MM-DDTHH:MM:SS)')
    .option('--end <datetime>', 'New end time in local time (YYYY-MM-DDTHH:MM:SS)')
    .action(async (sessionIdStr, opts) => {
    try {
        const sessionId = Number(sessionIdStr);
        if (!Number.isInteger(sessionId) || sessionId <= 0) {
            throw new Error(`Invalid session ID: ${sessionIdStr}`);
        }
        const client = await getClient();
        const updated = await adjustSession(client, sessionId, {
            start_time: opts.start,
            end_time: opts.end,
        });
        console.log(`Session #${updated.id} updated.`);
        if (updated.start_time)
            console.log(`  Start: ${utcDbToLocal(updated.start_time)}`);
        if (updated.end_time)
            console.log(`  End:   ${utcDbToLocal(updated.end_time)}`);
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
// --- Invoice commands ---
program
    .command('invoice <session-ids...>')
    .description('Mark sessions as invoiced')
    .option('--ref <reference>', 'Invoice reference number')
    .action(async (sessionIds, opts) => {
    try {
        const client = await getClient();
        const ids = parsePositiveSessionIds(sessionIds);
        const count = await markInvoiced(client, ids, opts.ref);
        console.log(`Marked ${count} session(s) as invoiced.${opts.ref ? ` Ref: ${opts.ref}` : ''}`);
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
program
    .command('paid <session-ids...>')
    .description('Mark sessions as paid')
    .action(async (sessionIds) => {
    try {
        const client = await getClient();
        const ids = parsePositiveSessionIds(sessionIds);
        const count = await markPaid(client, ids);
        console.log(`Marked ${count} session(s) as paid.`);
    }
    catch (e) {
        console.error(e.message);
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
    .option('--payment-terms <days>', 'Payment terms in days for DueDate calculation', (value) => parseBoundedNonNegativeInteger(value, 'Payment terms', 3650))
    .action(async (opts) => {
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
            }
            else {
                console.log(csv);
            }
        }
        else if (opts.format === 'xlsx') {
            const buffer = await exportXlsx(client, filters);
            const outputPath = opts.output ?? 'billing-export.xlsx';
            writeFileSync(outputPath, buffer);
            console.log(`Excel file written to: ${outputPath}`);
        }
        else {
            const csv = await exportCsv(client, filters);
            if (opts.output) {
                writeFileSync(opts.output, csv);
                console.log(`CSV file written to: ${opts.output}`);
            }
            else {
                console.log(csv);
            }
        }
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
// --- Config ---
const configCmd = program.command('config').description('Manage global settings');
configCmd
    .command('get [key]')
    .description('View settings')
    .action(async (key) => {
    try {
        const client = await getClient();
        const settings = await getSettings(client);
        if (key) {
            const value = settings[key];
            if (value === undefined) {
                console.error(`Unknown setting: ${key}`);
                process.exit(1);
            }
            console.log(`${key}: ${value}`);
        }
        else {
            console.log(`Default rate: ${settings.default_rate}/hr`);
            console.log(`Default currency: ${settings.default_currency}`);
            console.log(`Default min block: ${settings.default_min_block_minutes} minutes`);
        }
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
configCmd
    .command('set <key> <value>')
    .description('Update a setting')
    .action(async (key, value) => {
    try {
        const client = await getClient();
        await updateSetting(client, key, value);
        console.log(`Setting "${key}" updated to "${value}".`);
    }
    catch (e) {
        console.error(e.message);
        process.exit(1);
    }
});
(async () => {
    await maybeAnnounceUpdate(process.argv.slice(2));
    await program.parseAsync(process.argv);
})().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
//# sourceMappingURL=index.js.map