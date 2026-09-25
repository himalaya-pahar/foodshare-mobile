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
 * Formats a timestamp into a full date and time string in the user's LOCAL timezone.
 * Example: "26 Sep 2026, 02:05 AM"
 */
export function formatLocalDateTime(
  value: Date | string | number | null | undefined,
): string {
  const date = asDate(value);
  if (!date) return "Time unavailable";

  try {
    return date.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return date.toLocaleString();
  }
}

/**
 * Formats a timestamp into a date-only string in the user's LOCAL timezone.
 * Example: "26 Sep 2026"
 */
export function formatLocalDate(
  value: Date | string | number | null | undefined,
): string {
  const date = asDate(value);
  if (!date) return "Date unavailable";

  try {
    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Formats a timestamp into a concise timeline time string in the user's LOCAL timezone.
 * Example: "26 Sep, 02:05 AM"
 */
export function formatLocalTimelineTime(
  value: Date | string | number | null | undefined,
): string {
  const date = asDate(value);
  if (!date) return "Time unavailable";

  try {
    return date.toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return date.toLocaleString();
  }
}

// Aliases for backwards compatibility with existing screen imports
export const formatBangladeshDateTime = formatLocalDateTime;
export const formatBangladeshDate = formatLocalDate;
export const formatBangladeshTimelineTime = formatLocalTimelineTime;
