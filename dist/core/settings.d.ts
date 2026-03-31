import type { Client } from '@libsql/client';
import type { Settings, SettingKey, Project } from '../types.js';
export declare function getSettings(client: Client): Promise<Settings>;
export declare function getSetting(client: Client, key: SettingKey): Promise<string>;
export declare function updateSetting(client: Client, key: SettingKey, value: string): Promise<void>;
export declare function getEffectiveRate(client: Client, project: Project): Promise<number>;
export declare function getEffectiveCurrency(client: Client, project: Project): Promise<string>;
export declare function getEffectiveMinBlock(client: Client, project: Project): Promise<number>;
