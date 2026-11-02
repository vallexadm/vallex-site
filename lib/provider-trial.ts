export const BASIC_TRIAL_DAYS = 365;
export const BASIC_TRIAL_LABEL = "1 ano (365 dias)";

export function createBasicTrialPeriod(startedAt = new Date()) {
  return {
    startedAt,
    endsAt: new Date(startedAt.getTime() + BASIC_TRIAL_DAYS * 24 * 60 * 60 * 1000),
  };
}

export function isProviderTrialExpired(periodEnd: string | null | undefined, now = new Date()) {
  if (!periodEnd) return true;
  const end = new Date(periodEnd).getTime();
  return !Number.isFinite(end) || end <= now.getTime();
}
