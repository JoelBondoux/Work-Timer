export type McpClientId = 'claude-desktop' | 'cursor' | 'vscode' | 'vscode-insiders' | 'claude-code' | 'codex-cli' | 'gemini-cli' | 'chatgpt-desktop';
type JsonSchema = 'claude' | 'copilot';
export type JsonMcpTarget = {
    id: McpClientId;
    label: string;
    kind: 'json';
    configPath: string;
    schema: JsonSchema;
    exists: boolean;
};
export type CommandMcpTarget = {
    id: McpClientId;
    label: string;
    kind: 'command';
    command: string;
    args: string[];
};
export type ManualMcpTarget = {
    id: McpClientId;
    label: string;
    kind: 'manual';
    notes: string;
};
export type McpTarget = JsonMcpTarget | CommandMcpTarget | ManualMcpTarget;
export type InstallStatus = 'updated' | 'unchanged' | 'created' | 'skipped-missing' | 'skipped-manual' | 'error';
export type InstallResult = {
    target: McpTarget;
    status: InstallStatus;
    message: string;
    backupPath?: string;
};
export declare function getRecommendedLlmSystemPrompt(): string;
export declare function upsertMcpServerConfig(input: {
    sourceText: string;
    schema: JsonSchema;
    serverPath: string;
}): {
    changed: boolean;
    outputText: string;
};
export declare function discoverMcpTargets(params?: {
    platform?: NodeJS.Platform;
    env?: NodeJS.ProcessEnv;
}): McpTarget[];
export declare function applyJsonMcpInstall(input: {
    target: JsonMcpTarget;
    serverPath: string;
    dryRun: boolean;
    createMissing: boolean;
}): InstallResult;
export declare function applyCommandMcpInstall(input: {
    target: CommandMcpTarget;
    serverPath: string;
    dryRun: boolean;
}): InstallResult;
export declare function getManualInstallInstructions(target: McpTarget, serverPath: string): string[];
export declare function parseClientIds(input: string): McpClientId[];
export {};
