import type { Client } from '@libsql/client';
import type { Settings, SettingKey, Project } from '../types.js';

const VALID_KEYS: SettingKey[] = ['default_rate', 'default_currency', 'default_min_block_minutes'];

export async function getSettings(client: Client): Promise<Settings> {
  const result = await client.execute('SELECT key, value FROM settings');
  const map = new Map<string, string>();
  for (const row of result.rows) {
    map.set(row.key as string, row.value as string);
  }

  return {
    default_rate: parseFloat(map.get('default_rate') ?? '0'),
    default_currency: map.get('default_currency') ?? 'USD',
    default_min_block_minutes: parseInt(map.get('default_min_block_minutes') ?? '15', 10),
  };
}

export async function getSetting(client: Client, key: SettingKey): Promise<string> {
  const result = await client.execute({
    sql: 'SELECT value FROM settings WHERE key = ?',
    args: [key],
  });
  if (result.rows.length === 0) {
    throw new Error(`Unknown setting: ${key}`);
  }
  return result.rows[0].value as string;
}

export async function updateSetting(client: Client, key: SettingKey, value: string): Promise<void> {
  if (!VALID_KEYS.includes(key)) {
    throw new Error(`Invalid setting key: ${key}. Valid keys: ${VALID_KEYS.join(', ')}`);
  }

  // Validate numeric settings
  if (key === 'default_rate') {
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num < 0) {
      throw new Error(`${key} must be a non-negative finite number`);
    }
  }

  if (key === 'default_min_block_minutes') {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0 || num > 1440) {
      throw new Error(`${key} must be an integer between 0 and 1440`);
    }
  }

  await client.execute({
    sql: 'UPDATE settings SET value = ? WHERE key = ?',
    args: [value, key],
  });
}

export async function getEffectiveRate(client: Client, project: Project): Promise<number> {
  if (project.billing_rate !== null) return project.billing_rate;
  const settings = await getSettings(client);
  return settings.default_rate;
}

export async function getEffectiveCurrency(client: Client, project: Project): Promise<string> {
  if (project.currency !== null) return project.currency;
  const settings = await getSettings(client);
  return settings.default_currency;
}

export async function getEffectiveMinBlock(client: Client, project: Project): Promise<number> {
  if (project.min_block_minutes !== null) return project.min_block_minutes;
  const settings = await getSettings(client);
  return settings.default_min_block_minutes;
}
