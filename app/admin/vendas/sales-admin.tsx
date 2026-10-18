"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase/client";

type Stage = "novo" | "contato" | "qualificacao" | "proposta" | "aguardando_decisao" | "negociacao" | "ganho" | "perdido";
type SalesClient = {
  id: string; contact_name: string; company_name: string | null; email: string | null; phone: string | null;
  niche: string | null; city: string | null; state: string | null; product: string; product_scope: string | null;
  stage: Stage; contract_start_date: string | null; contract_end_date: string | null; source: string; responsible_name: string | null; setup_value: number | null; monthly_value: number | null;
  notes: string | null; archived_at: string | null; created_at: string; updated_at: string;
};
type Activity = { id: string; client_id: string; actor_name: string; event_type: string; description: string; created_at: string };
type SalesForm = Omit<SalesClient, "id" | "archived_at" | "created_at" | "updated_at" | "setup_value" | "monthly_value"> & { setup_value: string; monthly_value: string; activity_note: string };
type Access = { isAdmin?: boolean; isStaff?: boolean; permissions?: Record<string, Record<string, boolean>> };

const products = [
  ["trafego_pago", "Gestão de tráfego pago"], ["servicofacil", "Plano ServiçoFácil"],
  ["site_institucional", "Site institucional"], ["desenvolvimento_web", "Desenvolvimento web / sistema"],
  ["planilha_automatizada", "Planilha automatizada"], ["consultoria", "Consultoria digital"], ["outro", "Outro produto ou serviço VALLEX"],
];
const stages: [Stage, string][] = [["novo", "Novo"], ["contato", "Contato feito"], ["qualificacao", "Qualificação"], ["proposta", "Proposta enviada"], ["aguardando_decisao", "Aguardando decisão do cliente"], ["negociacao", "Em negociação"], ["ganho", "Fechado / ganho"], ["perdido", "Perdido"]];
const sources = [["prospeccao", "Prospecção"], ["indicacao", "Indicação"], ["site", "Site VALLEX"], ["redes_sociais", "Redes sociais"], ["parceiro", "Parceiro"], ["outro", "Outro"]];
const productLabel = (value: string) => products.find(([key]) => key === value)?.[1] ?? value;
const stageLabel = (value: string) => stages.find(([key]) => key === value)?.[1] ?? value;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const amountInput = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const formattedDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { dateStyle: "medium" });
const formatAmountInput = (value: number | null) => value === null ? "" : amountInput.format(value);
function normalizeAmountInput(value: string) {
  const cleaned = value.trim().replace(/\s|R\$/gi, "");
  if (!cleaned) return "";
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? amountInput.format(parsed) : value;
}

function emptyForm(): SalesForm {
  return { contact_name: "", company_name: "", email: "", phone: "", niche: "", city: "", state: "", product: "trafego_pago", product_scope: "", stage: "novo", contract_start_date: null, contract_end_date: null, source: "prospeccao", responsible_name: "", setup_value: "", monthly_value: "", notes: "", activity_note: "" };
}
function clientForm(client: SalesClient): SalesForm {
  return { ...client, company_name: client.company_name ?? "", email: client.email ?? "", phone: client.phone ?? "", niche: client.niche ?? "", city: client.city ?? "", state: client.state ?? "", product_scope: client.product_scope ?? "", contract_start_date: client.contract_start_date ?? null, contract_end_date: client.contract_end_date ?? null, responsible_name: client.responsible_name ?? "", setup_value: formatAmountInput(client.setup_value), monthly_value: formatAmountInput(client.monthly_value), notes: client.notes ?? "", activity_note: "" };
}

export default function SalesAdmin() {
  const [clients, setClients] = useState<SalesClient[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [access, setAccess] = useState<Access>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("todos");
  const [productFilter, setProductFilter] = useState("todos");
  const [listMode, setListMode] = useState<"ativos" | "arquivados">("ativos");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<SalesForm>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Entre com sua conta autorizada da VALLEX.");
      const headers = { Authorization: `Bearer ${token}` };
      const accessResponse = await fetch("/api/admin/access", { headers, cache: "no-store" });
      const accessResult = await accessResponse.json() as Access;
      setAccess(accessResult);
      if (!accessResponse.ok || (!accessResult.isAdmin && !accessResult.isStaff)) throw new Error("Esta conta não tem acesso ao painel administrativo.");
      const response = await fetch("/api/admin/vendas", { headers, cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível carregar as vendas.");
      setClients(result.clients ?? []); setActivity(result.activity ?? []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Falha ao carregar a área de vendas."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const isOwner = access.isAdmin === true;
  const permissions = access.permissions?.sales ?? {};
  const canCreate = isOwner || permissions.create === true;
  const canEdit = isOwner || permissions.edit === true;
  const canDelete = isOwner || permissions.delete === true;
  const visibleClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return clients.filter((client) => {
      if (listMode === "ativos" && client.archived_at || listMode === "arquivados" && !client.archived_at) return false;
      if (stageFilter !== "todos" && client.stage !== stageFilter) return false;
      if (productFilter !== "todos" && client.product !== productFilter) return false;
      return !normalized || [client.contact_name, client.company_name ?? "", client.email ?? "", client.phone ?? "", client.niche ?? "", client.city ?? "", client.product_scope ?? ""]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(normalized));
    });
  }, [clients, listMode, productFilter, query, stageFilter]);

  function startNew() { setEditingId(""); setForm(emptyForm()); setFormOpen(true); setMessage(""); setError(""); }
  function startEdit(client: SalesClient) { setEditingId(client.id); setForm(clientForm(client)); setFormOpen(true); setMessage(""); setError(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const body = { ...form, id: editingId || undefined };
      const response = await fetch("/api/admin/vendas", { method: editingId ? "PATCH" : "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível salvar o cadastro.");
      setFormOpen(false); setEditingId(""); setMessage(editingId ? "Cadastro atualizado." : "Cliente cadastrado."); await load();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  }
  async function setArchived(client: SalesClient, archived: boolean) {
    setSaving(true); setError(""); setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/admin/vendas", { method: "PATCH", headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: client.id, archived }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível atualizar o cadastro.");
      setMessage(archived ? "Cadastro arquivado." : "Cadastro restaurado."); await load();
    } catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "Falha ao atualizar o cadastro."); }
    finally { setSaving(false); }
  }

  if (!loading && !isOwner && !access.isStaff) return <section className="vallex-admin-section"><p className="vallex-admin-error">Acesso restrito à equipe autorizada da VALLEX.</p></section>;

  return <>
    <section className="vallex-admin-metrics" aria-label="Resumo de vendas">
      <article><span>Clientes e oportunidades</span><strong>{clients.filter((item) => !item.archived_at).length}</strong><small>Cadastros ativos</small></article>
      <article><span>Em negociação</span><strong>{clients.filter((item) => !item.archived_at && ["proposta", "negociacao"].includes(item.stage)).length}</strong><small>Propostas e tratativas abertas</small></article>
      <article><span>Contratos ganhos</span><strong>{clients.filter((item) => !item.archived_at && item.stage === "ganho").length}</strong><small>Vendas registradas</small></article>
      <article><span>Valor mensal potencial</span><strong>{money.format(clients.filter((item) => !item.archived_at && item.stage !== "perdido").reduce((sum, item) => sum + Number(item.monthly_value ?? 0), 0))}</strong><small>Cadastros ativos no funil</small></article>
    </section>
    <section className="vallex-admin-section">
      <div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Relacionamento comercial</span><h2>Clientes e oportunidades</h2><p>Registre o negócio, o nicho, o produto VALLEX de interesse, valores e o histórico de cada negociação.</p></div>{canCreate && <button type="button" className="vallex-admin-primary" onClick={startNew}>+ Cadastrar cliente</button>}</div>
      {error && <p className="vallex-admin-error" role="alert">{error}</p>}{message && <p className="traffic-admin-notice" role="status">{message}</p>}
      {formOpen && <form onSubmit={(event) => void submit(event)} className="vallex-sales-form mb-6 rounded-2xl border border-violet-200 bg-slate-50 p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">{editingId ? "Editar cliente ou oportunidade" : "Novo cliente ou oportunidade"}</h3><button type="button" className="vallex-admin-back" onClick={() => setFormOpen(false)}>Fechar</button></div>
        <div className="grid min-w-0 gap-4 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-medium">Nome do contato<input required minLength={2} maxLength={140} className="rounded-lg border border-slate-300 px-3 py-2" value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-medium">Empresa / nome comercial<input maxLength={160} className="rounded-lg border border-slate-300 px-3 py-2" value={form.company_name ?? ""} onChange={(event) => setForm({ ...form, company_name: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-medium">Nicho de atuação<input maxLength={120} placeholder="Ex.: barbearia, alimentação, refrigeração" className="rounded-lg border border-slate-300 px-3 py-2" value={form.niche ?? ""} onChange={(event) => setForm({ ...form, niche: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-medium">E-mail<input type="email" maxLength={180} className="rounded-lg border border-slate-300 px-3 py-2" value={form.email ?? ""} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-medium">Telefone / WhatsApp<input maxLength={40} className="rounded-lg border border-slate-300 px-3 py-2" value={form.phone ?? ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,90px)] gap-3"><label className="grid min-w-0 gap-1 text-sm font-medium">Cidade<input maxLength={100} className="rounded-lg border border-slate-300 px-3 py-2" value={form.city ?? ""} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label><label className="grid min-w-0 gap-1 text-sm font-medium">UF<input maxLength={2} className="rounded-lg border border-slate-300 px-3 py-2 uppercase" value={form.state ?? ""} onChange={(event) => setForm({ ...form, state: event.target.value.toUpperCase() })} /></label></div>
          <label className="grid gap-1 text-sm font-medium">Produto VALLEX<select className="vallex-sales-select rounded-lg border border-slate-300 px-3 py-2" value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })}>{products.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium">Plano / escopo desejado<input maxLength={180} placeholder="Ex.: Crescimento, Basic, site de agendamento" className="rounded-lg border border-slate-300 px-3 py-2" value={form.product_scope ?? ""} onChange={(event) => setForm({ ...form, product_scope: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-medium">Etapa comercial<select className="vallex-sales-select rounded-lg border border-slate-300 px-3 py-2" value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value as Stage })}>{stages.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium">Início do contrato<input type="date" className="rounded-lg border border-slate-300 px-3 py-2" value={form.contract_start_date ?? ""} onChange={(event) => setForm({ ...form, contract_start_date: event.target.value || null })} /></label>
          <label className="grid gap-1 text-sm font-medium">Fim / renovação do contrato<input type="date" className="rounded-lg border border-slate-300 px-3 py-2" value={form.contract_end_date ?? ""} onChange={(event) => setForm({ ...form, contract_end_date: event.target.value || null })} /></label>
          <label className="grid gap-1 text-sm font-medium">Origem<select className="vallex-sales-select rounded-lg border border-slate-300 px-3 py-2" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}>{sources.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium">Vendedor / responsável<input maxLength={140} className="rounded-lg border border-slate-300 px-3 py-2" value={form.responsible_name ?? ""} onChange={(event) => setForm({ ...form, responsible_name: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-medium">Implantação / entrada (R$)<input inputMode="decimal" placeholder="0,00" className="rounded-lg border border-slate-300 px-3 py-2" value={form.setup_value} onChange={(event) => setForm({ ...form, setup_value: event.target.value })} onBlur={() => setForm((current) => ({ ...current, setup_value: normalizeAmountInput(current.setup_value) }))} /></label>
          <label className="grid gap-1 text-sm font-medium">Recorrência mensal (R$)<input inputMode="decimal" placeholder="0,00" className="rounded-lg border border-slate-300 px-3 py-2" value={form.monthly_value} onChange={(event) => setForm({ ...form, monthly_value: event.target.value })} onBlur={() => setForm((current) => ({ ...current, monthly_value: normalizeAmountInput(current.monthly_value) }))} /></label>
          <label className="grid gap-1 text-sm font-medium md:col-span-3">Observações sobre o negócio<textarea rows={3} maxLength={4000} className="rounded-lg border border-slate-300 px-3 py-2" value={form.notes ?? ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <label className="grid gap-1 text-sm font-medium md:col-span-3">Registro desta conversa / negociação<textarea rows={2} maxLength={2000} placeholder="Ex.: reunião marcada, escopo solicitado, retorno combinado…" className="rounded-lg border border-slate-300 px-3 py-2" value={form.activity_note} onChange={(event) => setForm({ ...form, activity_note: event.target.value })} /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-3"><button className="vallex-admin-primary" disabled={saving} type="submit">{saving ? "Salvando…" : editingId ? "Salvar alterações" : "Cadastrar cliente"}</button><button className="vallex-admin-back" type="button" onClick={() => setFormOpen(false)}>Cancelar</button></div>
      </form>}
      <div className="vallex-admin-subtabs" aria-label="Cadastros de vendas"><button className={listMode === "ativos" ? "is-active" : ""} type="button" onClick={() => setListMode("ativos")}>Ativos ({clients.filter((item) => !item.archived_at).length})</button><button className={listMode === "arquivados" ? "is-active" : ""} type="button" onClick={() => setListMode("arquivados")}>Arquivados ({clients.filter((item) => item.archived_at).length})</button></div>
      <div className="vallex-sales-filters mb-5 grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(170px,220px)_minmax(190px,240px)]"><label className="grid min-w-0 gap-1 text-sm font-medium">Buscar cliente, empresa ou nicho<input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Nome, e-mail, telefone, cidade…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="grid min-w-0 gap-1 text-sm font-medium">Etapa<select className="vallex-sales-select rounded-lg border border-slate-300 px-3 py-2" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="todos">Todas as etapas</option>{stages.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="grid min-w-0 gap-1 text-sm font-medium">Produto<select className="vallex-sales-select rounded-lg border border-slate-300 px-3 py-2" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option value="todos">Todos os produtos</option>{products.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      {loading ? <p className="vallex-admin-empty">Carregando clientes e oportunidades…</p> : visibleClients.length === 0 ? <p className="vallex-admin-empty">Nenhum cadastro encontrado com esses filtros.</p> : <div className="space-y-3">{visibleClients.map((client) => {
        const isOpen = expanded[client.id] === true;
        const log = activity.filter((entry) => entry.client_id === client.id);
        return <article key={client.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="vallex-admin-eyebrow">{productLabel(client.product)} · {stageLabel(client.stage)}</span><h3 className="mt-1 text-lg font-semibold">{client.company_name || client.contact_name}</h3><p className="text-sm text-slate-600">Contato: {client.contact_name}{client.niche ? ` · ${client.niche}` : ""}{client.city ? ` · ${client.city}${client.state ? `/${client.state}` : ""}` : ""}</p></div><div className="flex flex-wrap gap-2">{canEdit && !client.archived_at && <button type="button" className="vallex-admin-secondary" onClick={() => startEdit(client)}>Editar</button>}{canDelete && !client.archived_at && <button type="button" className="vallex-admin-back" disabled={saving} onClick={() => void setArchived(client, true)}>Arquivar</button>}{canEdit && client.archived_at && <button type="button" className="vallex-admin-secondary" disabled={saving} onClick={() => void setArchived(client, false)}>Restaurar</button>}<button type="button" className="vallex-admin-secondary" aria-expanded={isOpen} onClick={() => setExpanded((current) => ({ ...current, [client.id]: !current[client.id] }))}>{isOpen ? "Recolher" : "Detalhes e histórico"}</button></div></div>
          {isOpen && <div className="mt-4 grid gap-5 border-t border-slate-200 pt-4 md:grid-cols-2"><div className="space-y-2 text-sm"><p><strong>Produto/escopo:</strong> {client.product_scope || "Não informado"}</p><p><strong>Período do contrato:</strong> {client.contract_start_date ? formattedDate(client.contract_start_date) : "Não definido"} – {client.contract_end_date ? formattedDate(client.contract_end_date) : "Sem data final"}</p><p><strong>E-mail:</strong> {client.email || "Não informado"}</p><p><strong>Telefone:</strong> {client.phone || "Não informado"}</p><p><strong>Origem:</strong> {sources.find(([key]) => key === client.source)?.[1] ?? client.source}</p><p><strong>Responsável:</strong> {client.responsible_name || "Não definido"}</p><p><strong>Implantação:</strong> {client.setup_value === null ? "Não definido" : money.format(client.setup_value)} · <strong>Mensal:</strong> {client.monthly_value === null ? "Não definido" : money.format(client.monthly_value)}</p>{client.notes && <p><strong>Observações:</strong> {client.notes}</p>}<p className="text-xs text-slate-500">Criado em {dateTime.format(new Date(client.created_at))} · Atualizado em {dateTime.format(new Date(client.updated_at))}</p></div><div><h4 className="mb-2 font-semibold">Histórico</h4>{log.length ? <ol className="space-y-2">{log.map((entry) => <li key={entry.id} className="border-l-2 border-violet-300 pl-3 text-sm"><p>{entry.description}</p><p className="text-xs text-slate-500">{entry.actor_name} · {dateTime.format(new Date(entry.created_at))}</p></li>)}</ol> : <p className="text-sm text-slate-500">Nenhuma atividade registrada.</p>}</div></div>}
        </article>;
      })}</div>}
    </section>
  </>;
}
