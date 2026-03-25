export interface Project {
  id: number;
  name: string;
  billing_rate: number | null;
  currency: string | null;
  min_block_minutes: number | null;
  archived: number;
  created_at: string;
}

export interface Session {
  id: number;
  project_id: number;
  start_time: string;
  end_time: string | null;
  status: 'running' | 'paused' | 'completed';
  notes: string | null;
  invoiced_at: string | null;
  invoice_ref: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Pause {
  id: number;
  session_id: number;
  pause_start: string;
  pause_end: string | null;
}

export interface Settings {
  default_rate: number;
  default_currency: string;
  default_min_block_minutes: number;
}

export interface BillingRecord {
  session_id: number;
  project_name: string;
  date: string;
  start_time: string;
  end_time: string;
  raw_duration_minutes: number;
  billed_duration_minutes: number;
  rate: number;
  currency: string;
  amount: number;
  invoiced: boolean;
  invoice_ref: string | null;
  paid: boolean;
  notes: string | null;
}

export interface BillingSummary {
  records: BillingRecord[];
  totals_by_project: Map<string, ProjectTotal>;
}

export interface ProjectTotal {
  project_name: string;
  total_raw_minutes: number;
  total_billed_minutes: number;
  total_amount: number;
  currency: string;
}

export interface RunningTimer {
  session_id: number;
  project_id: number;
  project_name: string;
  start_time: string;
  status: 'running' | 'paused';
  elapsed_minutes: number;
  notes: string | null;
}

export type SettingKey = 'default_rate' | 'default_currency' | 'default_min_block_minutes';

export interface Config {
  turso_url: string;
  turso_auth_token: string;
}
