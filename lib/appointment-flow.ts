export const appointmentLabels = {
  scheduled: "Confirmado",
  on_way: "Em deslocamento",
  arrived: "Cheguei ao local",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Cliente ausente",
} as const;
export type AppointmentStatus = keyof typeof appointmentLabels;
export const activeAppointmentStatuses: AppointmentStatus[] = ["scheduled", "on_way", "arrived", "in_progress"];
const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["on_way", "arrived", "in_progress", "cancelled", "no_show"],
  on_way: ["arrived", "in_progress", "cancelled", "no_show"],
  arrived: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed", "cancelled"],
  completed: [], cancelled: [], no_show: [],
};
export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return typeof value === "string" && Object.hasOwn(appointmentLabels, value);
}
export function canTransition(from: AppointmentStatus, to: AppointmentStatus, canManage: boolean) {
  return transitions[from].includes(to) && (canManage || to !== "cancelled");
}
export function arrivalEstimate(minutes: unknown, now = new Date()) {
  if (!Number.isInteger(minutes) || Number(minutes) < 1 || Number(minutes) > 480) return null;
  return new Date(now.getTime() + Number(minutes) * 60_000).toISOString();
}
export function trackingExpiry(endsAt: string | null, now = new Date()) {
  const end = endsAt ? new Date(endsAt).getTime() : now.getTime();
  return new Date(Math.min(now.getTime() + 90 * 86400_000, Math.max(now.getTime(), end) + 7 * 86400_000)).toISOString();
}
