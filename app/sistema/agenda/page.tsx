"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import SystemBrand from "@/components/SystemBrand";
import ActionNotice from "@/components/ActionNotice";
import { supabase } from "@/lib/supabase/client";
import { defaultMemberPermissions, normalizeMemberPermissions, type MemberPermissions } from "@/lib/team-permissions";
import { appointmentLabels, activeAppointmentStatuses, canTransition, type AppointmentStatus } from "@/lib/appointment-flow";
type Customer = { id: string; name: string; phone: string | null; address: string | null };
type Person = { id: string; name: string };
type Appointment = { id: string; title: string; details: string | null; starts_at: string; ends_at: string | null; status: AppointmentStatus; assigned_to: string; assigned_name: string | null; buffer_minutes: number; arrival_estimate_at: string | null; revision: number; updated_at: string; customers: Customer | null };
type Notice = { message: string; error?: boolean } | null;
type History = { id: string; created_at: string; before_data: { status: AppointmentStatus; starts_at: string } | null; after_data: { status: AppointmentStatus; starts_at: string; change_reason: string | null } };
const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900";
const button = "rounded-lg border border-purple-200 px-4 py-2.5 text-sm font-semibold text-purple-800 hover:bg-purple-50 disabled:opacity-50";
const format = (value: string) => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const localDate = (value: string) => { const date = new Date(value); return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16); };
async function api(method: string, body?: Record<string, unknown>, query = "") {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sua sessão expirou. Entre novamente.");
  const response = await fetch(`/api/sistema/agenda${query}`, { method, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.message || "Não foi possível concluir a operação.");
  return result;
}
function Feedback({ notice, close }: { notice: Notice; close: () => void }) { return notice ? <ActionNotice inline message={notice.message} error={notice.error} onClose={close} /> : null; }
export default function AgendaPage() {
  const [role, setRole] = useState("");
  const [permissions, setPermissions] = useState<MemberPermissions>(defaultMemberPermissions);
  const [organization, setOrganization] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [team, setTeam] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(null), [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const [scope, setScope] = useState("today"), [person, setPerson] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await api("GET");
      setRole(result.role); setPermissions(normalizeMemberPermissions(result.permissions)); setOrganization(result.organization.name);
      setAppointments(result.appointments); setCustomers(result.customers); setTeam(result.team); setLoadError("");
    } catch (err) { setLoadError(err instanceof Error ? err.message : "Não foi possível consultar a agenda."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const manager = role === "owner" || permissions.agenda.manage;
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const form = event.currentTarget, data = new FormData(form);
    lock.current = true; setSaving(true); setNotice(null);
    try {
      await api("POST", { customer_id: data.get("customer"), assigned_to: data.get("assignee"), title: data.get("title"), details: data.get("details"), starts_at: new Date(String(data.get("start"))).toISOString(), ends_at: new Date(String(data.get("end"))).toISOString(), buffer_minutes: Number(data.get("buffer")) });
      form.reset(); setNotice({ message: "Atendimento confirmado. O horário e o intervalo estão reservados para esse profissional." }); await load();
    } catch (err) { setNotice({ message: err instanceof Error ? err.message : "Não foi possível agendar.", error: true }); }
    finally { lock.current = false; setSaving(false); }
  }
  const today = new Date().toLocaleDateString("pt-BR");
  const visible = appointments.filter(a => (!person || a.assigned_to === person) && (scope === "all" || (scope === "today" ? new Date(a.starts_at).toLocaleDateString("pt-BR") === today : new Date(a.starts_at) >= new Date() && activeAppointmentStatuses.includes(a.status))));
  const next = visible.find(a => activeAppointmentStatuses.includes(a.status));
  if (loading) return <main className="p-10">Carregando agenda…</main>;
  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <header className="bg-[#17002E] px-6 py-5 text-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4"><SystemBrand /><Link href="/sistema" className="rounded-lg border border-purple-300 px-4 py-3">← Voltar ao painel</Link></div></header>
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><h1 className="text-3xl font-bold">Agenda e atendimentos</h1><p className="mt-2 text-slate-600">{organization} · Acompanhe a ordem dos clientes, a situação e os horários reservados.</p>
      {loadError && <div><Feedback notice={{ message: loadError, error: true }} close={() => setLoadError("")} /><button type="button" onClick={() => void load()} className={`${button} mt-3`}>Atualizar agenda</button></div>}
      {manager && <form onSubmit={create} className="mt-7 rounded-xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold">Agendar atendimento</h2>
        <p className="mt-2 text-sm text-slate-600">Informe o término para reservar toda a duração. O intervalo posterior pode ser usado para deslocamento ou preparação.</p>
        <fieldset disabled={saving} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>Cliente<select required name="customer" className={field} defaultValue=""><option value="" disabled>Selecione</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Responsável<select required name="assignee" className={field}>{team.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="sm:col-span-2">Título do atendimento<input required name="title" minLength={2} maxLength={200} className={field} placeholder="Ex.: Corte, visita ao imóvel ou manutenção" /></label>
          <label>Início<input required name="start" type="datetime-local" className={field} /></label>
          <label>Término previsto<input required name="end" type="datetime-local" className={field} /></label>
          <label>Intervalo após o atendimento (minutos)<input required name="buffer" type="number" min={0} max={240} defaultValue={0} className={field} /></label>
          <label className="sm:col-span-2">Orientações internas (opcional)<textarea name="details" maxLength={5000} className={field} /><span className="text-xs text-slate-500">Não aparecem no link do cliente.</span></label>
        </fieldset>
        <button disabled={saving || !customers.length || !team.length} className="mt-5 rounded-lg bg-purple-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Agendando…" : "Confirmar agendamento"}</button><Feedback notice={notice} close={() => setNotice(null)} />
      </form>}
      <section className="mt-8"><div className="flex flex-wrap items-end gap-4"><h2 className="mr-auto text-xl font-semibold">Ordem dos atendimentos</h2><label>Período<select className={field} value={scope} onChange={e => setScope(e.target.value)}><option value="today">Hoje</option><option value="upcoming">Próximos</option><option value="all">Todos</option></select></label>{manager && <label>Profissional<select className={field} value={person} onChange={e => setPerson(e.target.value)}><option value="">Todos</option>{team.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}<button onClick={() => void load()} className={button}>Atualizar lista</button></div>
        {!visible.length && <p className="mt-5 rounded-xl bg-white p-6">Nenhum atendimento neste filtro.</p>}
        <div className="mt-5 space-y-5">{visible.map((a, index) => <AppointmentCard key={a.id} appointment={a} team={team} manager={manager} canUpdate={manager || permissions.agenda.updateAssigned} next={a.id === next?.id} index={index+1} reload={load} all={appointments} />)}</div>
      </section>
    </div>
  </main>;
}
function AppointmentCard({ appointment: a, team, manager, canUpdate, next, index, reload, all }: { appointment: Appointment; team: Person[]; manager: boolean; canUpdate: boolean; next: boolean; index: number; reload: () => Promise<void>; all: Appointment[] }) {
  const [notice, setNotice] = useState<Notice>(null), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [editing, setEditing] = useState(false), [eta, setEta] = useState(20);
  const [tracking, setTracking] = useState(""), [expiry, setExpiry] = useState("");
  const [history, setHistory] = useState<History[] | null>(null);
  const active = activeAppointmentStatuses.includes(a.status);
  const nextReservation = all.find(other => other.id !== a.id && other.assigned_to === a.assigned_to && activeAppointmentStatuses.includes(other.status) && new Date(other.starts_at) > new Date(a.starts_at));
  const duration = a.ends_at ? new Date(a.ends_at).getTime()-new Date(a.starts_at).getTime() : 3600000;
  const projectedEnd = a.status === "on_way" && a.arrival_estimate_at ? new Date(a.arrival_estimate_at).getTime()+duration+a.buffer_minutes*60000 : 0;
  const late = nextReservation && projectedEnd >= new Date(nextReservation.starts_at).getTime();
  async function mutate(body: Record<string, unknown>, success: string) {
    if (lock.current) return; lock.current = true; setBusy(true); setNotice(null);
    try {
      const result = await api("PATCH", { id: a.id, expected_revision: a.revision, ...body });
      if (result.trackingPath) { setTracking(window.location.origin + result.trackingPath); setExpiry(result.expiresAt); }
      if (body.action === "tracking_revoke") { setTracking(""); setExpiry(""); }
      setNotice({ message: success }); setEditing(false); setHistory(null); await reload();
    } catch (err) { setNotice({ message: err instanceof Error ? err.message : "Não foi possível concluir.", error: true }); }
    finally { lock.current = false; setBusy(false); }
  }
  async function readHistory() {
    if (lock.current) return; lock.current = true; setBusy(true);
    try { const result = await api("GET", undefined, `?history_id=${a.id}`); setHistory(result.history); }
    catch (err) { setNotice({ message: err instanceof Error ? err.message : "Histórico indisponível.", error: true }); }
    finally { lock.current = false; setBusy(false); }
  }
  function reschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void mutate({ action: "reschedule", starts_at: new Date(String(data.get("start"))).toISOString(), ends_at: new Date(String(data.get("end"))).toISOString(), assigned_to: data.get("assignee"), buffer_minutes: Number(data.get("buffer")), reason: data.get("reason") }, "Atendimento remarcado. O cliente verá o novo horário no mesmo link de acompanhamento, se ele ainda estiver válido. Confira a validade e gere outro link se necessário.");
  }
  return <article className={`rounded-xl border bg-white p-5 shadow-sm ${next ? "border-purple-400" : "border-slate-200"}`}>
    <div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm text-slate-600">{index}º · {format(a.starts_at)}{a.ends_at ? ` até ${new Date(a.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : " · duração reservada: 60 minutos"}</p><h3 className="mt-1 text-lg font-semibold">{a.title}</h3>{next && <p className="mt-1 text-sm font-semibold text-purple-700">Primeiro atendimento ativo neste filtro</p>}</div><span className="h-fit rounded-full bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-800">{appointmentLabels[a.status]}</span></div>
    <p className="mt-3">Cliente: <strong>{a.customers?.name ?? "Cliente"}</strong>{manager && ` · Responsável: ${a.assigned_name ?? "Equipe"}`}</p>
    {a.customers?.phone && <p className="mt-1 text-sm">Telefone: {a.customers.phone}</p>}{a.customers?.address && <p className="mt-1 text-sm">Endereço: {a.customers.address}</p>}
    {a.details && <p className="mt-2 whitespace-pre-wrap text-sm">Orientações internas: {a.details}</p>}
    <p className="mt-2 text-sm text-slate-600">Intervalo posterior reservado: {a.buffer_minutes} minutos.</p>
    {a.status === "on_way" && <p className="mt-2 font-medium">{a.arrival_estimate_at ? `Chegada estimada: ${format(a.arrival_estimate_at)} (manual).` : "Previsão de chegada ainda não informada."}</p>}
    {late && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-900">A chegada estimada, somada à duração prevista e ao intervalo, alcança o próximo atendimento deste profissional. Revise os horários e avise os clientes; a agenda não remarca automaticamente.</p>}
    {canUpdate && active && <div className="mt-4"><div className="flex flex-wrap gap-2">{(["arrived", "in_progress", "completed", "no_show"] as AppointmentStatus[]).filter(status => canTransition(a.status, status, manager)).map(status => <button key={status} disabled={busy} className={button} onClick={() => { if (status !== "no_show" || window.confirm("Confirmar que o cliente não compareceu?")) void mutate({ action: "status", status }, "Situação atualizada. O acompanhamento do cliente mostrará a alteração."); }}>{appointmentLabels[status]}</button>)}</div>
      {["scheduled", "on_way"].includes(a.status) && <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void mutate({ action: "status", status: "on_way", eta_minutes: eta }, "Previsão manual de chegada atualizada no acompanhamento."); }}><label className="text-sm">Chegada estimada daqui a (minutos)<input required type="number" min={1} max={480} value={eta} onChange={event => setEta(Number(event.target.value))} className={field} /></label><button disabled={busy} className={button}>{a.status === "on_way" ? "Atualizar previsão" : "Iniciar deslocamento"}</button></form>}
    </div>}
    <div className="mt-4 flex flex-wrap gap-2">
      {manager && active && <><button disabled={busy} className={button} onClick={() => setEditing(value => !value)}>{editing ? "Fechar remarcação" : "Remarcar / trocar responsável"}</button><button disabled={busy} className={button} onClick={() => { if (window.confirm("Cancelar este atendimento e liberar o horário?")) void mutate({ action: "status", status: "cancelled" }, "Atendimento cancelado e horário liberado."); }}>Cancelar atendimento</button><button disabled={busy} className={button} onClick={() => { if (window.confirm("Gerar link individual de acompanhamento? Qualquer link anterior deste atendimento deixará de funcionar. Compartilhe apenas com o cliente.")) void mutate({ action: "tracking_create" }, "Link gerado. Copie e envie ao cliente; nenhum envio é automático."); }}>Gerar / renovar link do cliente</button></>}
      {manager && <button disabled={busy} className={button} onClick={() => { if (window.confirm("Desativar o link de acompanhamento deste atendimento?")) void mutate({ action: "tracking_revoke" }, "Acompanhamento desativado."); }}>Desativar link</button>}
      <button disabled={busy} className={button} onClick={() => history ? setHistory(null) : void readHistory()}>{history ? "Fechar histórico" : "Histórico"}</button>
    </div>
    {editing && manager && <form onSubmit={reschedule} className="mt-4 rounded-xl border border-purple-100 bg-purple-50 p-4"><h4 className="font-semibold">Remarcar atendimento</h4><fieldset disabled={busy} className="mt-3 grid gap-4 sm:grid-cols-2">
      <label>Início<input required type="datetime-local" name="start" defaultValue={localDate(a.starts_at)} className={field} /></label>
      <label>Término<input required type="datetime-local" name="end" defaultValue={localDate(a.ends_at || new Date(new Date(a.starts_at).getTime()+3600000).toISOString())} className={field} /></label>
      <label>Responsável<select required name="assignee" defaultValue={a.assigned_to} className={field}>{!team.some(p => p.id === a.assigned_to) && <option value={a.assigned_to}>Responsável anterior (escolha um ativo)</option>}{team.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Intervalo posterior (minutos)<input required type="number" name="buffer" min={0} max={240} defaultValue={a.buffer_minutes} className={field} /></label>
      <label className="sm:col-span-2">Motivo da remarcação<input required name="reason" minLength={3} maxLength={500} className={field} /></label>
    </fieldset><p className="mt-3 text-sm">A remarcação volta a situação para Confirmado e apaga a previsão anterior de chegada. Combine a mudança com o cliente.</p><button disabled={busy} className={`${button} mt-3`}>Salvar remarcação</button></form>}

    {tracking && <div className="mt-4 rounded-lg bg-purple-50 p-4"><label className="text-sm font-medium">Link individual para o cliente<input readOnly value={tracking} className={field} onFocus={event => event.target.select()} /></label><p className="mt-2 text-xs">Válido até {format(expiry)}. Exibe somente empresa, horário, situação e estimativa. Não mostra notas, endereço, localização ou outros clientes.</p><div className="mt-3 flex flex-wrap gap-2"><button className={button} onClick={async () => { try { await navigator.clipboard.writeText(tracking); setNotice({ message: "Link copiado." }); } catch { setNotice({ message: "Selecione o endereço acima e copie manualmente.", error: true }); } }}>Copiar link</button><a className={button} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Acompanhe seu atendimento: ${tracking}`)}`}>Abrir WhatsApp para compartilhar</a></div></div>}
    <Feedback notice={notice} close={() => setNotice(null)} />
    {history && <div className="mt-4 border-t pt-4"><h4 className="font-semibold">Histórico de alterações</h4>{!history.length && <p className="mt-2 text-sm">Nenhuma alteração registrada após a atualização da agenda.</p>}<ul className="mt-2 space-y-3">{history.map(item => <li key={item.id} className="text-sm"><strong>{format(item.created_at)}</strong> · {item.before_data ? `${appointmentLabels[item.before_data.status]} → ` : "Criado · "}{appointmentLabels[item.after_data.status]}<p>Horário: {format(item.after_data.starts_at)}</p>{item.after_data.change_reason && <p>Motivo: {item.after_data.change_reason}</p>}</li>)}</ul><p className="mt-2 text-xs text-slate-500">Até 30 alterações mais recentes. Histórico interno, não compartilhado no link.</p></div>}
  </article>;
}
