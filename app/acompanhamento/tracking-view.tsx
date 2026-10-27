"use client";
import { useEffect, useState } from "react";
import { appointmentLabels, isAppointmentStatus, type AppointmentStatus } from "@/lib/appointment-flow";
type PublicAppointment = { provider: string; startsAt: string; endsAt: string | null; status: AppointmentStatus; arrivalEstimateAt: string | null; updatedAt: string };
const format = (value: string) => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
export default function TrackingView() {
  const [appointment, setAppointment] = useState<PublicAppointment | null>(null);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    let cancelled = false;
    let active: AbortController | null = null;
    async function refresh() {
      if (document.hidden) return;
      active?.abort();
      const controller = new AbortController(); active = controller;
      try {
        const response = await fetch("/api/public/agenda/acompanhamento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !body.ok || !isAppointmentStatus(body.appointment?.status)) throw new Error(body.message || "Acompanhamento indisponível.");
        if (!cancelled && !controller.signal.aborted) { setAppointment(body.appointment); setError(""); setCheckedAt(new Date().toISOString()); }
      } catch (err) {
        if (!cancelled && !controller.signal.aborted) { setAppointment(null); setError(err instanceof Error ? err.message : "Não foi possível atualizar."); }
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; active?.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [attempt]);
  return <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900"><section className="mx-auto max-w-lg rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
    <p className="text-sm font-semibold text-purple-700">VALLEX · ServiçoFácil</p><h1 className="mt-3 text-2xl font-bold">Acompanhe seu atendimento</h1>
    {error ? <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">{error}</p> : !appointment ? <p className="mt-5">Consultando atendimento…</p> : <div aria-live="polite">
      <p className="mt-5 font-semibold">{appointment.provider}</p><p className="mt-2">Horário marcado: {format(appointment.startsAt)}</p>
      <p className="mt-5 rounded-xl bg-purple-50 p-4 text-lg font-semibold text-purple-800">{appointmentLabels[appointment.status]}</p>
      {appointment.status === "on_way" && <p className="mt-4">{appointment.arrivalEstimateAt ? new Date(appointment.arrivalEstimateAt) > new Date(checkedAt) ? `Chegada estimada: ${format(appointment.arrivalEstimateAt)}.` : "A previsão anterior já passou. Aguarde uma atualização do prestador." : "O prestador está a caminho e ainda não informou uma previsão de chegada."}</p>}
      <p className="mt-4 text-sm text-slate-600">Última alteração pelo prestador: {format(appointment.updatedAt)}.</p>
      <p className="mt-3 text-sm text-slate-500">A previsão é informada manualmente e pode mudar. Esta página não rastreia a localização do profissional. Atualização automática a cada 30 segundos enquanto estiver aberta.</p>
    </div>}
    <button type="button" onClick={() => setAttempt(value => value+1)} className="mt-6 rounded-lg bg-purple-700 px-4 py-3 font-semibold text-white">Atualizar acompanhamento</button>
    <p className="mt-5 text-xs text-slate-500">Este link dá acesso ao acompanhamento. Compartilhe apenas com as pessoas envolvidas no atendimento.</p>
  </section></main>;
}
