export function isProviderTrialExpired(periodEnd: string | null | undefined, now = new Date()) {
  if (!periodEnd) return true;
  const end = new Date(periodEnd).getTime();
  return !Number.isFinite(end) || end <= now.getTime();
}
