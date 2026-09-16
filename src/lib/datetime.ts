const BANGLADESH_TIME_ZONE = "Asia/Dhaka";

function asDate(value: Date | string): Date | null {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatBangladeshDateTime(value: Date | string): string {
  const date = asDate(value);

  if (!date) return "Time unavailable";

  return date.toLocaleString("en-GB", {
    timeZone: BANGLADESH_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatBangladeshDate(value: Date | string): string {
  const date = asDate(value);

  if (!date) return "Date unavailable";

  return date.toLocaleDateString("en-GB", {
    timeZone: BANGLADESH_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatBangladeshTimelineTime(value: Date | string): string {
  const date = asDate(value);

  if (!date) return "Time unavailable";

  return date.toLocaleString("en-GB", {
    timeZone: BANGLADESH_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
