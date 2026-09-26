const BD_OFFSET_MS = 6 * 60 * 60 * 1000; // Bangladesh Time is fixed at UTC+6 (no DST)
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Normalizes and parses dates from API / DB into Date objects.
 * Server stores timestamps in UTC. If a string has no timezone offset or 'Z',
 * it is assumed to be UTC and normalized before parsing so that JavaScript
 * does not interpret it as local time.
 */
export function asDate(
  value: Date | string | number | null | undefined,
): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Check if the string already has a timezone indicator:
    // Examples: "Z", "z", "+06:00", "-05:00", "+0600", "+06"
    const hasTimezone = /([Zz]|[+-]\d{2}(?::?\d{2})?)$/.test(trimmed);

    let normalized = trimmed;
    // Only append 'Z' if it's a date-time string (has hours:minutes), not a pure date
    if (!hasTimezone && normalized.includes(":")) {
      if (!normalized.includes("T") && normalized.includes(" ")) {
        normalized = normalized.replace(" ", "T");
      }
      normalized = `${normalized}Z`;
    }

    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }

    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return null;
}

/**
 * Solidly formats a timestamp into Bangladesh Time (UTC+6).
 * Uses explicit UTC+6 calculation so it NEVER falls back to UTC+0 on any device/engine.
 * Example: "26 Sep 2026, 10:56 AM"
 */
export function formatBangladeshDateTime(
  value: Date | string | number | null | undefined,
): string {
  const date = asDate(value);
  if (!date) return "Time unavailable";

  // Shift epoch by +6 hours to read exact Bangladesh components via UTC getters
  const bd = new Date(date.getTime() + BD_OFFSET_MS);
  const day = bd.getUTCDate();
  const month = MONTHS_SHORT[bd.getUTCMonth()];
  const year = bd.getUTCFullYear();
  let hours = bd.getUTCHours();
  const minutes = String(bd.getUTCMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const hoursFormatted = String(hours).padStart(2, "0");

  return `${day} ${month} ${year}, ${hoursFormatted}:${minutes} ${ampm}`;
}

/**
 * Solidly formats a timestamp into Bangladesh Date (UTC+6).
 * Example: "26 Sep 2026"
 */
export function formatBangladeshDate(
  value: Date | string | number | null | undefined,
): string {
  const date = asDate(value);
  if (!date) return "Date unavailable";

  const bd = new Date(date.getTime() + BD_OFFSET_MS);
  const day = bd.getUTCDate();
  const month = MONTHS_SHORT[bd.getUTCMonth()];
  const year = bd.getUTCFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Solidly formats a timestamp into a concise Bangladesh timeline time string (UTC+6).
 * Example: "26 Sep, 10:56 AM"
 */
export function formatBangladeshTimelineTime(
  value: Date | string | number | null | undefined,
): string {
  const date = asDate(value);
  if (!date) return "Time unavailable";

  const bd = new Date(date.getTime() + BD_OFFSET_MS);
  const day = bd.getUTCDate();
  const month = MONTHS_SHORT[bd.getUTCMonth()];
  let hours = bd.getUTCHours();
  const minutes = String(bd.getUTCMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const hoursFormatted = String(hours).padStart(2, "0");

  return `${day} ${month}, ${hoursFormatted}:${minutes} ${ampm}`;
}

// Aliases
export const formatLocalDateTime = formatBangladeshDateTime;
export const formatLocalDate = formatBangladeshDate;
export const formatLocalTimelineTime = formatBangladeshTimelineTime;
