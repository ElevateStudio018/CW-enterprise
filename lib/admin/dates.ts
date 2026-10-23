// Dates the Swedish way, in Swedish time.
const zone = "Europe/Stockholm";

export function formatDate(iso: string | Date, withYear = false): string {
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: zone });
}

export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: zone });
}

/** "i dag 14:05", "i går 09:12", "3 okt 16:40". */
export function formatRelative(iso: string | Date): string {
  const date = new Date(iso);
  const day = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: zone });
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000);
  const time = date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: zone });
  if (day(date) === day(now)) return `i dag ${time}`;
  if (day(date) === day(yesterday)) return `i går ${time}`;
  return formatDateTime(date);
}

/** The calendar day (YYYY-MM-DD) a moment falls on in Sweden. */
export function dayKey(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: zone });
}

/** The last `count` calendar days, oldest first, as YYYY-MM-DD. */
export function lastDays(count: number): string[] {
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * 86_400_000)));
  return days;
}
