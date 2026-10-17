"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import CurrencyInput from "@/components/CurrencyInput";
import { formatCurrencyInput } from "@/lib/currency";

type Plan = { id: string; code: string; name: string; tagline: string; price_label: string; description: string; features: string[]; published: boolean; sort_order: number };
type Lead = { id: string; name: string; phone: string; email: string | null; audience: string; organization_name: string | null; plan_code: string | null; need_description: string; status: string; service_value: number | null; media_budget: number | null; responsible_name: string | null; source: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null; referrer: string | null; landing_path: string | null; created_at: string };
type Campaign = { id: string; lead_id: string; name: string; channel: string; status: string; start_date: string | null; end_date: string | null; media_budget: number; amount_spent: number; impressions: number; clicks: number; leads_generated: number; conversions: number; notes: string | null };
type Activity = { id: string; lead_id: string; event_type: string; description: string; created_at: string };
type Data = { plans: Plan[]; leads: Lead[]; campaigns: Campaign[]; activity: Activity[] };
type TrafficPermissions = { view: boolean; manage_plans: boolean; manage_leads: boolean; manage_campaigns: boolean };

const pipeline = ["novo", "contato", "proposta", "negociacao", "fechado", "perdido"];
const pipelineLabels: Record<string, string> = { novo: "Novo", contato: "Em contato", proposta: "Proposta enviada", negociacao: "Em negociação", fechado: "Fechado", perdido: "Perdido" };
const campaignLabels: Record<string, string> = { planejada: "Planejada", ativa: "Ativa", pausada: "Pausada", concluida: "Concluída" };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function localDate(value: string) { return new Date(value).toLocaleDateString("pt-BR", { dateStyle: "medium" }); }
function numberInput(value: number | null | undefined) { return value === null || value === undefined ? "" : String(value); }
function moneyInput(value: number | null | undefined) { return value === null || value === undefined ? "" : formatCurrencyInput(value); }

export default function TrafficAdminPanel() {
  const [data, setData] = useState<Data>({ plans: [], leads: [], campaigns: [], activity: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");
  const [permissions, setPermissions] = useState<TrafficPermissions>({ view: false, manage_plans: false, manage_leads: false, manage_campaigns: false });
  const [leadDrafts, setLeadDrafts] = useState<Record<string, { status: string; serviceValue: string; mediaBudget: string; responsibleName: string; event: string }>>({});
  const [campaignDrafts, setCampaignDrafts] = useState<Record<string, { status: string; amountSpent: string; impressions: string; clicks: string; leadsGenerated: string; conversions: string; notes: string }>>({});
  const [campaignForm, setCampaignForm] = useState({ leadId: "", name: "", channel: "Google Ads", startDate: "", endDate: "", mediaBudget: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Entre na conta autorizada para visualizar os dados.");
      const accessResponse = await fetch("/api/admin/access", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const access = await accessResponse.json();
      const grants = access.permissions?.traffic ?? {};
      if (!accessResponse.ok || (!access.isAdmin && !access.isStaff) || (!(access.isAdmin === true) && grants.view !== true)) throw new Error("Sua conta não tem permissão para consultar o módulo de tráfego.");
      setPermissions(access.isAdmin ? { view: true, manage_plans: true, manage_leads: true, manage_campaigns: true } : { view: grants.view === true, manage_plans: grants.manage_plans === true, manage_leads: grants.manage_leads === true, manage_campaigns: grants.manage_campaigns === true });
      const response = await fetch("/api/admin/trafego", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json();
      setMigrationRequired(result.code === "TRAFFIC_SCHEMA_REQUIRED");
      if ([401, 403].includes(response.status)) throw new Error(result.message ?? "Entre com uma conta autorizada para administrar o tráfego.");
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível carregar o módulo de tráfego.");
      const next: Data = { plans: result.plans ?? [], leads: result.leads ?? [], campaigns: result.campaigns ?? [], activity: result.activity ?? [] };
      setData(next);
      setLeadDrafts(Object.fromEntries(next.leads.map((lead) => [lead.id, { status: lead.status, serviceValue: moneyInput(lead.service_value), mediaBudget: moneyInput(lead.media_budget), responsibleName: lead.responsible_name ?? "", event: "" }])));
      setCampaignDrafts(Object.fromEntries(next.campaigns.map((campaign) => [campaign.id, { status: campaign.status, amountSpent: moneyInput(campaign.amount_spent), impressions: numberInput(campaign.impressions), clicks: numberInput(campaign.clicks), leadsGenerated: numberInput(campaign.leads_generated), conversions: numberInput(campaign.conversions), notes: campaign.notes ?? "" }])));
      if (!campaignForm.leadId && next.leads.length) setCampaignForm((current) => ({ ...current, leadId: next.leads[0].id }));
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Falha ao carregar dados."); }
    finally { setLoading(false); }
  }, [campaignForm.leadId]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function requestApi(method: "PATCH" | "POST", payload: Record<string, unknown>, busyKey: string) {
    setSaving(busyKey); setError(""); setNotice("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/admin/trafego", { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível salvar.");
      await load(); setNotice("Alterações salvas.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Falha ao salvar."); }
    finally { setSaving(""); }
  }

  async function savePlan(event: FormEvent<HTMLFormElement>, plan: Plan) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await requestApi("PATCH", { kind: "plan", id: plan.id, code: plan.code, name: form.get("name"), tagline: form.get("tagline"), priceLabel: form.get("priceLabel"), description: form.get("description"), features: String(form.get("features") ?? "").split("\n"), published: form.get("published") === "on", sortOrder: plan.sort_order }, `plan-${plan.id}`);
  }

  const activeCampaigns = data.campaigns.filter((campaign) => campaign.status === "ativa").length;
  const pendingLeads = data.leads.filter((lead) => !["fechado", "perdido"].includes(lead.status)).length;
  const closedValue = data.leads.filter((lead) => lead.status === "fechado").reduce((total, lead) => total + Number(lead.service_value ?? 0), 0);
  const campaignTotals = useMemo(() => data.campaigns.reduce((sum, campaign) => ({
    spend: sum.spend + Number(campaign.amount_spent || 0), impressions: sum.impressions + Number(campaign.impressions || 0), clicks: sum.clicks + Number(campaign.clicks || 0), leads: sum.leads + Number(campaign.leads_generated || 0), conversions: sum.conversions + Number(campaign.conversions || 0),
  }), { spend: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0 }), [data.campaigns]);

  if (loading) return <p className="vallex-admin-empty">Carregando módulo de tráfego…</p>;
  if (error && !data.plans.length && !data.leads.length) return <div className="vallex-admin-error" role="alert">{error}{migrationRequired && <p className="mt-2">Após revisar, aplique a estrutura <code>supabase/trafego_pago.sql</code> no projeto Supabase para ativar este módulo.</p>}<div className="mt-3 flex flex-wrap gap-2"><button className="vallex-admin-secondary" type="button" onClick={() => void load()}>Tentar novamente</button><Link className="vallex-admin-secondary" href="/sistema/login?next=%2Fadmin%2Ftrafego">Entrar com conta autorizada</Link></div></div>;

  return <div className="traffic-admin">
    <div className="traffic-admin-heading"><div><span className="vallex-admin-eyebrow">Operação VALLEX</span><h2>Tráfego pago</h2><p>Planos públicos, contatos interessados, negociações e resultados de campanhas.</p></div><button className="vallex-admin-secondary" type="button" onClick={() => void load()}>Atualizar dados</button></div>
    {error && <p className="vallex-admin-error" role="alert">{error}</p>}{notice && <p className="traffic-admin-notice" role="status">{notice}</p>}

    <section className="traffic-admin-metrics" aria-label="Indicadores de tráfego pago">
      <article><span>Oportunidades abertas</span><strong>{pendingLeads}</strong><small>{data.leads.length} contato(s) no funil</small></article>
      <article><span>Negócios fechados</span><strong>{currency.format(closedValue)}</strong><small>{data.leads.filter((lead) => lead.status === "fechado").length} contrato(s) registrados</small></article>
      <article><span>Campanhas ativas</span><strong>{activeCampaigns}</strong><small>{data.campaigns.length} campanha(s) acompanhadas</small></article>
      <article><span>Investimento registrado</span><strong>{currency.format(campaignTotals.spend)}</strong><small>Orçamento de mídia: {currency.format(campaignTotals.spend)} · dados informados pela equipe</small></article>
      <article><span>Impressões / cliques</span><strong>{campaignTotals.impressions.toLocaleString("pt-BR")} / {campaignTotals.clicks.toLocaleString("pt-BR")}</strong><small>Conforme os relatórios lançados</small></article>
      <article><span>Leads / conversões</span><strong>{campaignTotals.leads} / {campaignTotals.conversions}</strong><small>Registrados nas campanhas</small></article>
    </section>

    <section className="vallex-admin-section"><div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Vitrine pública</span><h2>Três planos modelo</h2><p>Edite os nomes, textos, valores exibidos e itens de cada card. “Sob proposta” pode ser substituído por um preço definido pela VALLEX.</p></div></div>
      <div className="traffic-plan-editors">{data.plans.map((plan) => <form key={plan.id} className="traffic-plan-editor" onSubmit={(event) => void savePlan(event, plan)}><fieldset disabled={!permissions.manage_plans}>
        <h3>{plan.name}</h3>
        <label>Nome do plano<input name="name" required maxLength={100} defaultValue={plan.name} /></label>
        <label>Chamada curta<input name="tagline" maxLength={240} defaultValue={plan.tagline} /></label>
        <label>Preço exibido<input name="priceLabel" maxLength={100} defaultValue={plan.price_label} placeholder="Sob proposta" /></label>
        <label>Descrição<textarea name="description" maxLength={1000} rows={3} defaultValue={plan.description} /></label>
        <label>Itens do plano (um por linha)<textarea name="features" maxLength={2000} rows={4} defaultValue={(plan.features ?? []).join("\n")} /></label>
        <label className="traffic-publish-toggle"><input name="published" type="checkbox" defaultChecked={plan.published} /> Exibir na página pública</label>
        <button className="vallex-admin-primary" disabled={saving === `plan-${plan.id}`} type="submit">{saving === `plan-${plan.id}` ? "Salvando…" : "Salvar plano"}</button>
      </fieldset></form>)}</div>
    </section>

    <section className="vallex-admin-section"><div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Funil comercial</span><h2>Contatos e negociações</h2><p>Visitantes, clientes e prestadores entram aqui com origem e UTMs quando chegam por campanha.</p></div></div>
      {data.leads.length === 0 ? <p className="vallex-admin-empty">Nenhum contato de tráfego recebido ainda.</p> : <div className="traffic-lead-list">{data.leads.map((lead) => {
        const draft = leadDrafts[lead.id] ?? { status: lead.status, serviceValue: moneyInput(lead.service_value), mediaBudget: moneyInput(lead.media_budget), responsibleName: lead.responsible_name ?? "", event: "" };
        const history = data.activity.filter((item) => item.lead_id === lead.id).slice(0, 5);
        return <article className="traffic-lead-card" key={lead.id}>
          <div className="traffic-lead-head"><div><span className="vallex-admin-eyebrow">{lead.audience === "prestador" ? "Prestador VALLEX" : lead.audience === "cliente" ? "Cliente" : "Visitante"}{lead.plan_code ? ` · ${lead.plan_code}` : ""}</span><h3>{lead.name}</h3><small>{localDate(lead.created_at)}{lead.organization_name ? ` · ${lead.organization_name}` : ""}{lead.responsible_name ? ` · Responsável: ${lead.responsible_name}` : ""}</small></div><div className="traffic-lead-contact"><a href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}>{lead.phone}</a>{lead.email && <a href={`mailto:${lead.email}`}>{lead.email}</a>}</div></div>
          <p className="traffic-lead-need">{lead.need_description}</p>
          <div className="traffic-attribution">Origem: {lead.utm_source || lead.source || "direta"}{lead.utm_medium ? ` · ${lead.utm_medium}` : ""}{lead.utm_campaign ? ` · campanha ${lead.utm_campaign}` : ""}{lead.utm_content ? ` · conteúdo ${lead.utm_content}` : ""}{lead.utm_term ? ` · termo ${lead.utm_term}` : ""}{lead.referrer ? ` · veio de ${lead.referrer}` : ""}</div>
          <fieldset disabled={!permissions.manage_leads}><div className="traffic-lead-fields">
            <label>Etapa<select value={draft.status} onChange={(event) => setLeadDrafts((current) => ({ ...current, [lead.id]: { ...draft, status: event.target.value } }))}>{pipeline.map((status) => <option key={status} value={status}>{pipelineLabels[status]}</option>)}</select></label>
            <label>Valor da gestão (R$)<CurrencyInput min={0} value={draft.serviceValue} onChange={(serviceValue) => setLeadDrafts((current) => ({ ...current, [lead.id]: { ...draft, serviceValue } }))} /></label>
            <label>Orçamento de mídia (R$)<CurrencyInput min={0} value={draft.mediaBudget} onChange={(mediaBudget) => setLeadDrafts((current) => ({ ...current, [lead.id]: { ...draft, mediaBudget } }))} /></label>
            <label>Responsável<input maxLength={160} value={draft.responsibleName} onChange={(event) => setLeadDrafts((current) => ({ ...current, [lead.id]: { ...draft, responsibleName: event.target.value } }))} /></label>
            <label className="traffic-lead-event">Registro da negociação<input maxLength={2000} placeholder="Ex.: reunião marcada, proposta enviada, retorno combinado…" value={draft.event} onChange={(event) => setLeadDrafts((current) => ({ ...current, [lead.id]: { ...draft, event: event.target.value } }))} /></label>
            <button className="vallex-admin-primary" type="button" disabled={saving === `lead-${lead.id}`} onClick={() => void requestApi("PATCH", { kind: "lead", id: lead.id, status: draft.status, serviceValue: draft.serviceValue || null, mediaBudget: draft.mediaBudget || null, responsibleName: draft.responsibleName, event: draft.event }, `lead-${lead.id}`)}>{saving === `lead-${lead.id}` ? "Salvando…" : "Salvar e registrar"}</button>
          </div></fieldset>
          {history.length > 0 && <details className="traffic-history"><summary>Histórico ({history.length} registros recentes)</summary><ul>{history.map((item) => <li key={item.id}><time>{localDate(item.created_at)}</time> {item.description}</li>)}</ul></details>}
        </article>;
      })}</div>}
    </section>

    <section className="vallex-admin-section"><div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Acompanhamento</span><h2>Campanhas e indicadores</h2><p>Registre o escopo e atualize os números consultados nas plataformas de anúncios. Estes dados não são sincronizados automaticamente.</p></div></div>
      <form className="traffic-campaign-form" onSubmit={(event) => { event.preventDefault(); void requestApi("POST", { kind: "campaign", ...campaignForm }, "new-campaign"); }}><fieldset disabled={!permissions.manage_campaigns}>
        <label>Cliente<select required value={campaignForm.leadId} onChange={(event) => setCampaignForm({ ...campaignForm, leadId: event.target.value })}><option value="">Selecione</option>{data.leads.map((lead) => <option value={lead.id} key={lead.id}>{lead.name}</option>)}</select></label>
        <label>Campanha<input required maxLength={160} value={campaignForm.name} onChange={(event) => setCampaignForm({ ...campaignForm, name: event.target.value })} /></label>
        <label>Canal<select value={campaignForm.channel} onChange={(event) => setCampaignForm({ ...campaignForm, channel: event.target.value })}><option>Google Ads</option><option>Meta Ads</option><option>Outro</option></select></label>
        <label>Orçamento de mídia (R$)<CurrencyInput min={0} value={campaignForm.mediaBudget} onChange={(mediaBudget) => setCampaignForm({ ...campaignForm, mediaBudget })} /></label>
        <label>Início<input type="date" value={campaignForm.startDate} onChange={(event) => setCampaignForm({ ...campaignForm, startDate: event.target.value })} /></label>
        <label>Fim previsto<input type="date" value={campaignForm.endDate} onChange={(event) => setCampaignForm({ ...campaignForm, endDate: event.target.value })} /></label>
        <label className="traffic-full">Escopo / observações<textarea rows={2} maxLength={2000} value={campaignForm.notes} onChange={(event) => setCampaignForm({ ...campaignForm, notes: event.target.value })} /></label>
        <button className="vallex-admin-primary" type="submit" disabled={saving === "new-campaign" || data.leads.length === 0}>{saving === "new-campaign" ? "Registrando…" : "Registrar campanha"}</button>
      </fieldset></form>
      {data.campaigns.length === 0 ? <p className="vallex-admin-empty mt-4">As campanhas registradas aparecerão aqui.</p> : <div className="traffic-campaign-list">{data.campaigns.map((campaign) => {
        const draft = campaignDrafts[campaign.id] ?? { status: campaign.status, amountSpent: moneyInput(campaign.amount_spent), impressions: numberInput(campaign.impressions), clicks: numberInput(campaign.clicks), leadsGenerated: numberInput(campaign.leads_generated), conversions: numberInput(campaign.conversions), notes: campaign.notes ?? "" };
        const lead = data.leads.find((item) => item.id === campaign.lead_id);
        return <article className="traffic-campaign-card" key={campaign.id}><header><div><h3>{campaign.name}</h3><p>{lead?.name ?? "Cliente removido"} · {campaign.channel} · mídia prevista {currency.format(campaign.media_budget)}</p></div><span className="vallex-admin-badge">{campaignLabels[draft.status] ?? draft.status}</span></header>
          <fieldset disabled={!permissions.manage_campaigns}><div className="traffic-campaign-metrics"><label>Status<select value={draft.status} onChange={(event) => setCampaignDrafts((current) => ({ ...current, [campaign.id]: { ...draft, status: event.target.value } }))}>{Object.keys(campaignLabels).map((status) => <option key={status} value={status}>{campaignLabels[status]}</option>)}</select></label>
            {([ ["amountSpent", "Gasto (R$)"], ["impressions", "Impressões"], ["clicks", "Cliques"], ["leadsGenerated", "Leads"], ["conversions", "Conversões"] ] as const).map(([key, label]) => <label key={key}>{label}{key === "amountSpent" ? <CurrencyInput min={0} value={draft.amountSpent} onChange={(amountSpent) => setCampaignDrafts((current) => ({ ...current, [campaign.id]: { ...draft, amountSpent } }))} /> : <input type="number" min="0" step="1" value={draft[key]} onChange={(event) => setCampaignDrafts((current) => ({ ...current, [campaign.id]: { ...draft, [key]: event.target.value } }))} />}</label>)}
            <label className="traffic-full">Notas<textarea rows={2} value={draft.notes} onChange={(event) => setCampaignDrafts((current) => ({ ...current, [campaign.id]: { ...draft, notes: event.target.value } }))} /></label>
          </div><button type="button" className="vallex-admin-secondary mt-3" disabled={saving === `campaign-${campaign.id}`} onClick={() => void requestApi("PATCH", { kind: "campaign", id: campaign.id, status: draft.status, amountSpent: draft.amountSpent || 0, impressions: draft.impressions || 0, clicks: draft.clicks || 0, leadsGenerated: draft.leadsGenerated || 0, conversions: draft.conversions || 0, notes: draft.notes }, `campaign-${campaign.id}`)}>{saving === `campaign-${campaign.id}` ? "Salvando…" : "Atualizar indicadores"}</button></fieldset>
        </article>;
      })}</div>}
      <p className="traffic-disclaimer">O investimento em mídia é separado do valor da gestão da VALLEX e deve ser pago pelo cliente à plataforma de anúncios.</p>
    </section>
  </div>;
}
