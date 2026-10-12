const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

function datePartsInBusinessTimeZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: value("year"), month: value("month"), day: value("day") };
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nextMonthDate(year: number, month: number, day: number) {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();

  return formatDate(nextYear, nextMonth, Math.min(day, lastDay));
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function nextMonthlyAsaasDueDate(from = new Date()) {
  const { year, month, day } = datePartsInBusinessTimeZone(from);
  return nextMonthDate(year, month, day);
}

export function nextMonthlyDueDateAfter(value: string) {
  const parsed = parseDate(value);
  return parsed
    ? nextMonthDate(parsed.year, parsed.month, parsed.day)
    : null;
}

export function asaasPeriodEndFromDueDate(
  value?: string | null,
  now = new Date()
) {
  const parsed = value ? parseDate(value) : null;
  const dueDate = parsed
    ? formatDate(parsed.year, parsed.month, parsed.day)
    : nextMonthlyAsaasDueDate(now);
  const todayParts = datePartsInBusinessTimeZone(now);
  const today = formatDate(todayParts.year, todayParts.month, todayParts.day);
  const effectiveDate = dueDate < today ? nextMonthlyAsaasDueDate(now) : dueDate;

  // Asaas dates are Brazil calendar dates. 03:00 UTC is midnight in São Paulo.
  return `${effectiveDate}T03:00:00.000Z`;
}

export function isAsaasPeriodExpired(periodEnd: string, now = new Date()) {
  const end = new Date(periodEnd);
  if (!Number.isFinite(end.getTime())) return true;

  const endParts = datePartsInBusinessTimeZone(end);
  const nowParts = datePartsInBusinessTimeZone(now);
  const endDate = formatDate(endParts.year, endParts.month, endParts.day);
  const today = formatDate(nowParts.year, nowParts.month, nowParts.day);

  // Keep access through the due date; expiration starts on the following day.
  return endDate < today;
}
