function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toDate(date: Date | string): Date {
  return typeof date === "string" ? new Date(date) : date;
}

/**
 * Example: `workflow/dt={YYYY}-{MM}-{DD}` becomes `workflow/dt=2026-05-05`.
 */
export function formatDateTemplate(
  template: string,
  date: Date | string,
): string {
  const targetDate = toDate(date);
  return template
    .replace("{YYYY}", String(targetDate.getFullYear()))
    .replace("{MM}", pad2(targetDate.getMonth() + 1))
    .replace("{DD}", pad2(targetDate.getDate()));
}

export function formatTimestamp(
  date: Date,
  options?: { includeSeconds?: boolean },
): string {
  const year = String(date.getFullYear());
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());

  if (!options?.includeSeconds) {
    return `${year}${month}${day}-${hours}${minutes}`;
  }

  const seconds = pad2(date.getSeconds());
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}
