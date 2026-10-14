"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SystemBrand from "@/components/SystemBrand";
import { createClient } from "@supabase/supabase-js";

type Customer = { id: string; name: string; phone: string | null; address: string | null };
type TeamMember = { id: string; email: string; name: string; role: "owner" | "member" };
type Appointment = {
  id: string;
  title: string;
  details: string | null;
  starts_at: string;
  ends_at: string | null;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  assigned_to: string;
  assigned_name?: string | null;
  customers: Customer | null;
};

const statusLabels: Record<Appointment["status"], string> = {
  scheduled: "Agendado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function AgendaPage() {
  const [role, setRole] = useState<"owner" | "member" | "">("");
  const [organizationName, setOrganizationName] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [appliedSchedule, setAppliedSchedule] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const getToken = useCallback(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Configuração do Supabase não encontrada.");
    const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError("");
      const token = await getToken();
      if (!token) throw new Error("Sessão não encontrada. Faça login novamente.");
      const response = await fetch("/api/sistema/agenda", { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível carregar a agenda.");
      setRole(result.role);
      setOrganizationName(result.organization?.name ?? "");
      setAppointments(result.appointments ?? []);
      setCustomers(result.customers ?? []);
      setTeam(result.team ?? []);
      if (!assignedTo && result.team?.length) setAssignedTo(result.team[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a agenda.");
    } finally {
      setLoading(false);
    }
  }, [assignedTo, getToken]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appliedSchedule || appliedSchedule.startsAt !== startsAt || appliedSchedule.endsAt !== endsAt) {
      setError("Selecione e aplique a data e o horário antes de agendar.");
      return;
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const token = await getToken();
      const response = await fetch("/api/sistema/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customer_id: customerId, assigned_to: assignedTo, title, details, starts_at: new Date(appliedSchedule.startsAt).toISOString(), ends_at: appliedSchedule.endsAt ? new Date(appliedSchedule.endsAt).toISOString() : null }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível agendar.");
      setMessage("Atendimento agendado e atribuído com sucesso.");
      setCustomerId(""); setTitle(""); setDetails(""); setStartsAt(""); setEndsAt(""); setAppliedSchedule(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível agendar.");
    } finally { setSaving(false); }
  }

  function applySchedule() {
    setError(""); setMessage("");
    if (!startsAt) {
      setError("Escolha a data e a hora do atendimento.");
      return;
    }
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      setError("A previsão de término deve ser posterior ao horário do atendimento.");
      return;
    }
    setAppliedSchedule({ startsAt, endsAt });
    setMessage("Datas e horários aplicados.");
  }

  async function updateStatus(appointmentId: string, status: Appointment["status"]) {
    setError(""); setMessage("");
    try {
      const token = await getToken();
      const response = await fetch("/api/sistema/agenda", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: appointmentId, status }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível atualizar o atendimento.");
      setMessage("Andamento do atendimento atualizado.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar.");
    }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">Carregando agenda…</main>;

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-[#17002E] px-6 py-5 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <SystemBrand />
          <Link href="/sistema" className="inline-flex items-center gap-2 rounded-lg border border-purple-300 px-4 py-2 text-sm font-medium transition hover:bg-purple-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#17002E]"><span aria-hidden="true">←</span> Voltar ao painel</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-slate-500">Gestão da organização</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">Agenda</h2>
        <p className="mt-2 text-slate-600">{role === "owner" ? `Agende atendimentos e atribua à equipe de ${organizationName}.` : `Atendimentos atribuídos a você em ${organizationName}.`}</p>

        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</p>}

        {role === "owner" && <form onSubmit={submitAppointment} className="mt-8 rounded-xl border border-purple-100 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">Agendar atendimento</h3>
          <p className="mt-1 text-sm text-slate-600">O colaborador verá somente os atendimentos atribuídos a ele e os dados necessários para atender.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Cliente
              <select required value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900"><option value="">Selecione um cliente</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select>
            </label>
            <label className="text-sm font-medium text-slate-700">Responsável
              <select required value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-900">{team.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
            </label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Título do atendimento
              <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Manutenção do chuveiro" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900" />
            </label>
            <label className="text-sm font-medium text-slate-700">Data e hora
              <input required type="datetime-local" step={900} value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900" />
            </label>
            <label className="text-sm font-medium text-slate-700">Previsão de término (opcional)
              <input type="datetime-local" step={900} value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900" />
            </label>
            <div className="sm:col-span-2">
              <button type="button" onClick={applySchedule} className="rounded-lg border border-purple-300 px-4 py-2 text-sm font-semibold text-purple-800 hover:bg-purple-50">Aplicar datas e horários</button>
              <p className="mt-2 text-xs text-slate-500">Os horários são selecionados em intervalos de 15 minutos. Aplique após definir o início e, se desejar, o término.</p>
              {appliedSchedule && appliedSchedule.startsAt === startsAt && appliedSchedule.endsAt === endsAt && <p className="mt-2 text-sm font-medium text-green-700">Horários confirmados para o agendamento.</p>}
            </div>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Orientações para o atendimento (opcional)
              <textarea maxLength={5000} rows={3} value={details} onChange={(event) => setDetails(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 text-slate-900" />
            </label>
          </div>
          <button disabled={saving || !team.length || !customers.length || !appliedSchedule || appliedSchedule.startsAt !== startsAt || appliedSchedule.endsAt !== endsAt} className="mt-5 rounded-lg bg-purple-700 px-5 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-50">{saving ? "Agendando…" : "Agendar atendimento"}</button>
          {!customers.length && <p className="mt-3 text-sm text-amber-700">Cadastre um cliente ativo antes de agendar.</p>}
          {!team.length && <p className="mt-3 text-sm text-amber-700">Não foi possível localizar usuários da equipe para atribuir.</p>}
        </form>}

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-xl font-semibold text-slate-900">{role === "owner" ? "Atendimentos da organização" : "Meus atendimentos"}</h3><p className="mt-1 text-sm text-slate-600">{appointments.length} {appointments.length === 1 ? "atendimento" : "atendimentos"}</p></div></div>
          {appointments.length === 0 ? <p className="mt-6 rounded-lg bg-slate-50 p-8 text-center text-slate-600">{role === "owner" ? "Nenhum atendimento agendado ainda." : "Nenhum atendimento foi atribuído a você ainda."}</p> : <div className="mt-5 space-y-4">{appointments.map((appointment) => <article key={appointment.id} className="rounded-xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-500">{formatDateTime(appointment.starts_at)}{appointment.ends_at ? ` – ${new Date(appointment.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</p><h4 className="mt-1 text-lg font-semibold text-slate-900">{appointment.title}</h4></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{statusLabels[appointment.status]}</span></div>
            <div className="mt-4 grid gap-4 text-sm text-slate-700 sm:grid-cols-2"><div><p><strong>Cliente:</strong> {appointment.customers?.name ?? "Cliente"}</p>{role === "owner" && <p className="mt-1"><strong>Responsável:</strong> {appointment.assigned_name ?? "Membro da equipe"}</p>}{appointment.customers?.phone && <p className="mt-1"><strong>Telefone:</strong> {appointment.customers.phone}</p>}{appointment.customers?.address && <p className="mt-1"><strong>Endereço:</strong> {appointment.customers.address}</p>}</div>{appointment.details && <p className="whitespace-pre-wrap"><strong>Orientações:</strong> {appointment.details}</p>}</div>
            <div className="mt-4 flex flex-wrap gap-2">{role === "member" && appointment.status === "scheduled" && <button onClick={() => void updateStatus(appointment.id, "in_progress")} className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800">Iniciar atendimento</button>}{role === "member" && appointment.status === "in_progress" && <button onClick={() => void updateStatus(appointment.id, "completed")} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">Concluir atendimento</button>}{role === "owner" && ["scheduled", "in_progress"].includes(appointment.status) && <button onClick={() => void updateStatus(appointment.id, "cancelled")} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Cancelar atendimento</button>}</div>
          </article>)}</div>}
        </section>
      </section>
    </main>
  );
}
