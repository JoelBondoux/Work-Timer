/**
 * Time conversion utilities.
 *
 * The database stores all datetimes as UTC text without a timezone suffix
 * (e.g. "2026-03-31T14:00:00").  These helpers convert between that format
 * and the local wall-clock time that users expect to see and supply.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Formats a Date as a UTC datetime string matching the DB storage format
 * ("YYYY-MM-DDTHH:MM:SS", no trailing Z).
 */
function toUtcDbString(d: Date): string {
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

/**
 * Converts a UTC datetime string from the database ("YYYY-MM-DDTHH:MM:SS")
 * to a local-time datetime string in the same format.
 *
 * Example: "2026-03-31T14:00:00" in UTC-5 → "2026-03-31T09:00:00"
 */
export function utcDbToLocal(utcStr: string): string {
  const d = new Date(utcStr + 'Z');          // appending Z tells JS this is UTC
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/**
 * Returns the local calendar date (YYYY-MM-DD) for a UTC DB datetime string.
 *
 * Example: "2026-03-31T02:00:00" in UTC-5 → "2026-03-30"
 */
export function utcDbToLocalDate(utcStr: string): string {
  return utcDbToLocal(utcStr).slice(0, 10);
}

/**
 * Converts a user-supplied local datetime string ("YYYY-MM-DDTHH:MM:SS") to a
 * UTC DB string for storage.  Unlike the range-bound helpers, this expects a
 * full datetime — date-only strings are rejected.
 *
 * Example: "2026-03-31T09:00:00" in UTC-5 → "2026-03-31T14:00:00"
 */
export function localDateTimeToUtcDb(localStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(localStr)) {
    throw new Error(
      `"${localStr}" is a date-only value. Please supply a full datetime, e.g. "${localStr}T09:00:00".`
    );
  }
  const d = new Date(localStr);   // no Z → JS treats as local time
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid datetime: "${localStr}". Expected format: YYYY-MM-DDTHH:MM:SS`);
  }
  return toUtcDbString(d);
}

/**
 * Converts a user-supplied local date or datetime string to a UTC DB string
 * suitable as a **lower bound** (>= ) in SQL queries.
 *
 * - Date-only "YYYY-MM-DD"         → local midnight of that day → UTC
 * - Local datetime "YYYY-MM-DDTHH:MM:SS" → that local instant → UTC
 * - Explicit UTC "...Z" / "...+HH:MM"    → passed through correctly
 */
export function localToUtcRangeStart(localStr: string): string {
  // Date-only strings are ambiguous: JS treats "YYYY-MM-DD" as UTC midnight.
  // Append T00:00:00 (no Z) so JS interprets it as local midnight instead.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(localStr)
    ? localStr + 'T00:00:00'
    : localStr;
  return toUtcDbString(new Date(iso));
}

/**
 * Converts a user-supplied local date or datetime string to a UTC DB string
 * suitable as an **upper bound** (<= ) in SQL queries.
 *
 * - Date-only "YYYY-MM-DD" → local 23:59:59 of that day → UTC
 * - Otherwise behaves the same as localToUtcRangeStart.
 */
export function localToUtcRangeEnd(localStr: string): string {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(localStr)
    ? localStr + 'T23:59:59'
    : localStr;
  return toUtcDbString(new Date(iso));
}
