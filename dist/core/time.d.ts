/**
 * Time conversion utilities.
 *
 * The database stores all datetimes as UTC text without a timezone suffix
 * (e.g. "2026-03-31T14:00:00").  These helpers convert between that format
 * and the local wall-clock time that users expect to see and supply.
 */
/**
 * Converts a UTC datetime string from the database ("YYYY-MM-DDTHH:MM:SS")
 * to a local-time datetime string in the same format.
 *
 * Example: "2026-03-31T14:00:00" in UTC-5 → "2026-03-31T09:00:00"
 */
export declare function utcDbToLocal(utcStr: string): string;
/**
 * Returns the local calendar date (YYYY-MM-DD) for a UTC DB datetime string.
 *
 * Example: "2026-03-31T02:00:00" in UTC-5 → "2026-03-30"
 */
export declare function utcDbToLocalDate(utcStr: string): string;
/**
 * Converts a user-supplied local datetime string ("YYYY-MM-DDTHH:MM:SS") to a
 * UTC DB string for storage.  Unlike the range-bound helpers, this expects a
 * full datetime — date-only strings are rejected.
 *
 * Example: "2026-03-31T09:00:00" in UTC-5 → "2026-03-31T14:00:00"
 */
export declare function localDateTimeToUtcDb(localStr: string): string;
/**
 * Converts a user-supplied local date or datetime string to a UTC DB string
 * suitable as a **lower bound** (>= ) in SQL queries.
 *
 * - Date-only "YYYY-MM-DD"         → local midnight of that day → UTC
 * - Local datetime "YYYY-MM-DDTHH:MM:SS" → that local instant → UTC
 * - Explicit UTC "...Z" / "...+HH:MM"    → passed through correctly
 */
export declare function localToUtcRangeStart(localStr: string): string;
/**
 * Converts a user-supplied local date or datetime string to a UTC DB string
 * suitable as an **upper bound** (<= ) in SQL queries.
 *
 * - Date-only "YYYY-MM-DD" → local 23:59:59 of that day → UTC
 * - Otherwise behaves the same as localToUtcRangeStart.
 */
export declare function localToUtcRangeEnd(localStr: string): string;
