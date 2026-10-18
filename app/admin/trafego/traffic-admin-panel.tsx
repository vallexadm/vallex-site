"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import CurrencyInput from "@/components/CurrencyInput";
import { formatCurrencyInput } from "@/lib/currency";

type Plan = { id: string; code: string; name: string; tagline: string; price_label: string; description: string; features: string[]; published: boolean; sort_order: number };
type Lead = { id: string; name: string; phone: string; email: string | null; audience: string; organization_name: string | null; plan_code: string | null; need_description: string; status: string; service_value: number | null; media_budget: number | null; responsible_name: string | null; source: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null; referrer: string | null; landing_path: string | null; facebook_url: string | null; instagram_url: string | null; signed_contract_path: string | null; signed_contract_name: string | null; signed_contract_at: string | null; archived_at: string | null; archived_by: string | null; created_at: string };
type Campaign = { id: string; lead_id: string; name: string; channel: string; status: string; start_date: string | null; end_date: string | null; media_budget: number; amount_spent: number; impressions: number; clicks: number; leads_generated: number; conversions: number; notes: string | null };
type Activity = { id: string; lead_id: string; event_type: string; description: string; created_at: string };
type Data = { plans: Plan[]; leads: Lead[]; archivedLeads: Lead[]; campaigns: Campaign[]; activity: Activity[] };
type TrafficPermissions = { view: boolean; manage_plans: boolean; manage_leads: boolean; manage_campaigns: boolean };

const pipeline = ["novo", "contato", "proposta", "negociacao", "fechado", "perdido"];
const pipelineLabels: Record<string, string> = { novo: "Novo", contato: "Em contato", proposta: "Proposta enviada", negociacao: "Em negociação", fechado: "Fechado", perdido: "Perdido" };
const campaignLabels: Record<string, string> = { planejada: "Planejada", ativa: "Ativa", pausada: "Pausada", concluida: "Concluída" };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function localDate(value: string) { return new Date(value).toLocaleDateString("pt-BR", { dateStyle: "medium" }); }
function localCalendarDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { dateStyle: "medium" }); }
function numberInput(value: number | null | undefined) { return value === null || value === undefined ? "" : String(value); }
function moneyInput(value: number | null | undefined) { return value === null || value === undefined ? "" : formatCurrencyInput(value); }
function whatsappHref(phone: string, message: string) {
  let number = phone.replace(/\D/g, "");
  if (number.length === 10 || number.length === 11) number = `55${number}`;
  return number.startsWith("55") && (number.length === 12 || number.length === 13) ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}

export default function TrafficAdminPanel() {
  const [data, setData] = useState<Data>({ plans: [], leads: [], archivedLeads: [], campaigns: [], activity: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");
  const [contractFiles, setContractFiles] = useState<Record<string, File | null>>({});
  const [contractReady, setContractReady] = useState<Record<string, boolean>>({});
  const [lastSentContractFiles, setLastSentContractFiles] = useState<Record<string, File | null>>({});
  const [permissions, setPermissions] = useState<TrafficPermissions>({ view: false, manage_plans: false, manage_leads: false, manage_campaigns: false });
  const [leadExpansion, setLeadExpansion] = useState<Record<string, boolean>>({});
  const [leadDrafts, setLeadDrafts] = useState<Record<string, { status: string; serviceValue: string; mediaBudget: string; responsibleName: string; facebookUrl: string; instagramUrl: string; event: string }>>({});
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
      const next: Data = { plans: result.plans ?? [], leads: result.leads ?? [], archivedLeads: result.archivedLeads ?? [], campaigns: result.campaigns ?? [], activity: result.activity ?? [] };
      setData(next);
      setLeadDrafts(Object.fromEntries(next.leads.map((lead) => [lead.id, { status: lead.status, serviceValue: moneyInput(lead.service_value), mediaBudget: moneyInput(lead.media_budget), responsibleName: lead.responsible_name ?? "", facebookUrl: lead.facebook_url ?? "", instagramUrl: lead.instagram_url ?? "", event: "" }])));
      setCampaignDrafts(Object.fromEntries(next.campaigns.map((campaign) => [campaign.id, { status: campaign.status, amountSpent: moneyInput(campaign.amount_spent), impressions: numberInput(campaign.impressions), clicks: numberInput(campaign.clicks), leadsGenerated: numberInput(campaign.leads_generated), conversions: numberInput(campaign.conversions), notes: campaign.notes ?? "" }])));
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Falha ao carregar dados."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { if (!campaignForm.leadId && data.leads.length) setCampaignForm((current) => current.leadId ? current : { ...current, leadId: data.leads[0].id }); }, [campaignForm.leadId, data.leads]);

  async function requestApi(method: "PATCH" | "POST" | "DELETE", payload: Record<string, unknown>, busyKey: string): Promise<boolean> {
    setSaving(busyKey); setError(""); setNotice("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/admin/trafego", { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível salvar.");
      await load(); setNotice("Alterações salvas.");
      return true;
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Falha ao salvar."); return false; }
    finally { setSaving(""); }
  }

  async function archiveLead(lead: Lead, archived: boolean) {
    const displayName = lead.organization_name || lead.name;
    if (archived && !window.confirm(`Encerrar o contrato de ${displayName} e arquivar o cadastro? Ele sairá do funil ativo, mas campanhas, indicadores, documentos e histórico continuarão guardados e poderão ser consultados ou reativados.`)) return;
    await requestApi("PATCH", { kind: "archive_lead", id: lead.id, archived }, `archive-${lead.id}`);
  }

  async function deleteLeadPermanently(lead: Lead) {
    const displayName = lead.organization_name || lead.name;
    if (!lead.archived_at) return;
    if (!window.confirm(`Excluir definitivamente ${displayName}? O cadastro, campanhas, indicadores, documentos e histórico vinculados serão apagados e não poderão ser recuperados.`)) return;
    await requestApi("DELETE", { leadId: lead.id }, `delete-${lead.id}`);
  }

  async function uploadSignedContract(leadId: string, file: File) {
    setSaving(`contract-${leadId}`); setError(""); setNotice("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const form = new FormData();
      form.set("leadId", leadId);
      form.set("file", file);
      const response = await fetch("/api/admin/trafego/contrato", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível guardar o contrato assinado.");
      await load();
      setNotice("Contrato assinado anexado ao atendimento.");
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Falha ao anexar o contrato assinado."); }
    finally { setSaving(""); }
  }

  async function openSignedContract(leadId: string) {
    setSaving(`open-contract-${leadId}`); setError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch(`/api/admin/trafego/contrato?leadId=${encodeURIComponent(leadId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível abrir o contrato.");
      window.open(result.url as string, "_blank", "noopener,noreferrer");
    } catch (openError) { setError(openError instanceof Error ? openError.message : "Falha ao abrir o contrato assinado."); }
    finally { setSaving(""); }
  }

  async function deleteSignedContract(lead: Lead) {
    if (!window.confirm(`Excluir definitivamente o PDF assinado de ${lead.name}?`)) return;
    setSaving(`delete-contract-${lead.id}`); setError(""); setNotice("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/admin/trafego/contrato", { method: "DELETE", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ leadId: lead.id }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível excluir o PDF assinado.");
      await load();
      setNotice("PDF assinado excluído do atendimento.");
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Falha ao excluir o PDF assinado."); }
    finally { setSaving(""); }
  }

  function selectContractFile(leadId: string, file: File) {
    setError(""); setNotice("");
    setContractFiles((current) => ({ ...current, [leadId]: null }));
    setContractReady((current) => ({ ...current, [leadId]: false }));
    if ((file.type && file.type !== "application/pdf") || !file.name.toLowerCase().endsWith(".pdf")) { setError("Selecione o contrato em PDF."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("O PDF precisa ter até 10 MB."); return; }
    setContractFiles((current) => ({ ...current, [leadId]: file }));
    setContractReady((current) => ({ ...current, [leadId]: true }));
    setNotice("PDF selecionado. Agora escolha WhatsApp ou e-mail para preparar o envio.");
  }

  function clearSelectedContract(leadId: string) {
    setContractFiles((current) => ({ ...current, [leadId]: null }));
    setContractReady((current) => ({ ...current, [leadId]: false }));
    setNotice("Seleção local do contrato removida. Nenhum arquivo foi excluído do atendimento.");
  }

  function contractMessage(lead: Lead) {
    return `Olá, ${lead.name}! Segue o contrato da VALLEX em PDF. Você pode assinar digitalmente pelo gov.br no seu próprio dispositivo e devolver o PDF assinado por este WhatsApp.`;
  }

  async function shareContract(lead: Lead, channel: "whatsapp" | "email", resend = false, fileOverride?: File) {
    const file = fileOverride ?? contractFiles[lead.id];
    if (!file) { setError("Selecione o PDF do contrato antes de continuar."); return; }
    if (channel === "whatsapp" && !whatsappHref(lead.phone, contractMessage(lead))) { setError("O telefone deste contato não parece ter um número brasileiro válido para abrir o WhatsApp."); return; }
    if (channel === "email" && !lead.email) { setError("Este contato não tem e-mail cadastrado."); return; }

    const shareNavigator = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (navigator.share && shareNavigator.canShare?.({ files: [file] })) {
      try {
        const text = channel === "whatsapp"
          ? contractMessage(lead)
          : `Olá, ${lead.name}! Segue o contrato da VALLEX em PDF. Assine digitalmente pelo gov.br e responda a esta mensagem com o PDF assinado.`;
        await navigator.share({ title: "Contrato VALLEX para assinatura", text, files: [file] });
        const recorded = await requestApi("POST", { kind: "contract_dispatch", leadId: lead.id, channel, fileName: file.name }, `contract-dispatch-${lead.id}`);
        if (recorded) {
          setLastSentContractFiles((current) => ({ ...current, [lead.id]: file }));
          setContractReady((current) => ({ ...current, [lead.id]: false }));
          setNotice(resend ? "Contrato compartilhado novamente e registrado no histórico." : "Contrato compartilhado e registrado no histórico de enviados.");
        }
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
        setError("O compartilhamento foi cancelado ou falhou. O arquivo não foi baixado nem enviado.");
        return;
      }
    }

    setError(`Este navegador não permite compartilhar o PDF por ${channel === "whatsapp" ? "WhatsApp" : "e-mail"}. Nenhum arquivo foi baixado ou enviado.`);
  }

  async function prepareContractEmail(lead: Lead) {
    const file = contractFiles[lead.id];
    if (!file) { setError("Selecione o PDF do contrato antes de continuar."); return; }
    if (!lead.email) { setError("Este contato não tem e-mail cadastrado."); return; }
    const shareNavigator = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
    if (navigator.share && shareNavigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: "Contrato VALLEX para assinatura", text: contractMessage(lead), files: [file] });
        const recorded = await requestApi("POST", { kind: "contract_dispatch", leadId: lead.id, channel: "email", fileName: file.name }, `contract-dispatch-${lead.id}`);
        if (recorded) {
          setLastSentContractFiles((current) => ({ ...current, [lead.id]: file }));
          setContractReady((current) => ({ ...current, [lead.id]: false }));
          setNotice("Contrato compartilhado e registrado no histórico de enviados.");
        }
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
        setError("O compartilhamento foi cancelado ou falhou. O arquivo não foi baixado nem enviado.");
        return;
      }
    }
    setError("Este navegador não permite anexar o PDF a um e-mail automaticamente. Nenhum arquivo foi baixado ou enviado. Para envio automático, é necessária uma integração de e-mail.");
  }

  async function savePlan(event: FormEvent<HTMLFormElement>, plan: Plan) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await requestApi("PATCH", { kind: "plan", id: plan.id, code: plan.code, name: form.get("name"), tagline: form.get("tagline"), priceLabel: form.get("priceLabel"), description: form.get("description"), features: String(form.get("features") ?? "").split("\n"), published: form.get("published") === "on", sortOrder: plan.sort_order }, `plan-${plan.id}`);
  }

  const activeLeadIds = new Set(data.leads.map((lead) => lead.id));
  const activeLeadCampaigns = data.campaigns.filter((campaign) => activeLeadIds.has(campaign.lead_id));
  const allLeads = [...data.leads, ...data.archivedLeads].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const activeCampaigns = activeLeadCampaigns.filter((campaign) => campaign.status === "ativa").length;
  const pendingLeads = data.leads.filter((lead) => !["fechado", "perdido"].includes(lead.status)).length;
  const closedValue = data.leads.filter((lead) => lead.status === "fechado").reduce((total, lead) => total + Number(lead.service_value ?? 0), 0);
  const latestSiteLeadId = data.leads.find((lead) => lead.source === "pagina_trafego" || lead.source === "site" || lead.landing_path?.includes("/trafego-pago"))?.id;
  const selectedClientCampaigns = data.campaigns.filter((campaign) => campaign.lead_id === campaignForm.leadId);
  const selectedClient = allLeads.find((lead) => lead.id === campaignForm.leadId);
  const campaignTotals = useMemo(() => activeLeadCampaigns.reduce((sum, campaign) => ({
    spend: sum.spend + Number(campaign.amount_spent || 0), impressions: sum.impressions + Number(campaign.impressions || 0), clicks: sum.clicks + Number(campaign.clicks || 0), leads: sum.leads + Number(campaign.leads_generated || 0), conversions: sum.conversions + Number(campaign.conversions || 0),
  }), { spend: 0, impressions: 0, clicks: 0, leads: 0, conversions: 0 }), [data.campaigns, data.leads]);

  if (loading) return <p className="vallex-admin-empty">Carregando módulo de tráfego…</p>;
  if (error && !data.plans.length && !data.leads.length) return <div className="vallex-admin-error" role="alert">{error}{migrationRequired && <p className="mt-2">Após revisar, aplique as estruturas de tráfego pago, contratos assinados e clientes arquivados no projeto Supabase de teste.</p>}<div className="mt-3 flex flex-wrap gap-2"><button className="vallex-admin-secondary" type="button" onClick={() => void load()}>Tentar novamente</button><Link className="vallex-admin-secondary" href="/sistema/login?next=%2Fadmin%2Ftrafego">Entrar com conta autorizada</Link></div></div>;

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
      <details className="traffic-client-history"><summary>Histórico de clientes cadastrados ({allLeads.length})</summary>{allLeads.length === 0 ? <p className="vallex-admin-empty">Nenhum cliente cadastrado.</p> : <div className="traffic-client-history-scroll"><table><thead><tr><th>Cliente / empresa</th><th>Contato</th><th>Serviço / nicho</th><th>Produto / plano</th><th>Etapa</th><th>Situação</th><th>Responsável</th><th>Gestão mensal</th><th>Orçamento de mídia</th><th>Cadastro</th><th>Redes sociais</th><th>Ação</th></tr></thead><tbody>{allLeads.map((lead) => <tr key={lead.id}><td><strong>{lead.organization_name || lead.name}</strong>{lead.organization_name && <small>{lead.name}</small>}</td><td><a href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}>{lead.phone}</a>{lead.email && <a href={`mailto:${lead.email}`}>{lead.email}</a>}</td><td>{lead.need_description || lead.audience}</td><td>{lead.plan_code || "—"}</td><td>{pipelineLabels[lead.status] ?? lead.status}</td><td>{lead.archived_at ? `Encerrado · ${localDate(lead.archived_at)}` : "Ativo"}</td><td>{lead.responsible_name || "—"}</td><td>{lead.service_value === null ? "—" : currency.format(lead.service_value)}</td><td>{lead.media_budget === null ? "—" : currency.format(lead.media_budget)}</td><td>{localDate(lead.created_at)}</td><td><div className="traffic-social-links">{lead.facebook_url && <a href={lead.facebook_url} target="_blank" rel="noreferrer">Facebook</a>}{lead.instagram_url && <a href={lead.instagram_url} target="_blank" rel="noreferrer">Instagram</a>}{!lead.facebook_url && !lead.instagram_url && <span>—</span>}</div></td><td><div className="traffic-history-actions"><button className="vallex-admin-secondary traffic-archive-action" type="button" disabled={!permissions.manage_leads || saving === `archive-${lead.id}`} onClick={() => void archiveLead(lead, !lead.archived_at)}>{saving === `archive-${lead.id}` ? "Salvando…" : lead.archived_at ? "Reativar" : "Encerrar"}</button>{lead.archived_at && <button className="vallex-admin-secondary traffic-delete-lead" type="button" disabled={!permissions.manage_leads || saving === `delete-${lead.id}`} onClick={() => void deleteLeadPermanently(lead)}>{saving === `delete-${lead.id}` ? "Excluindo…" : "Excluir definitivamente"}</button>}</div></td></tr>)}</tbody></table></div>}</details>
      {data.leads.length === 0 ? <p className="vallex-admin-empty">Nenhum contato ativo no funil. Consulte o histórico de clientes cadastrados acima.</p> : <div className="traffic-lead-list">{data.leads.map((lead) => {
        const draft = leadDrafts[lead.id] ?? { status: lead.status, serviceValue: moneyInput(lead.service_value), mediaBudget: moneyInput(lead.media_budget), responsibleName: lead.responsible_name ?? "", facebookUrl: lead.facebook_url ?? "", instagramUrl: lead.instagram_url ?? "", event: "" };
        const history = data.activity.filter((item) => item.lead_id === lead.id).slice(0, 5);
        const contractHistory = data.activity.filter((item) => item.lead_id === lead.id && item.event_type === "contrato_enviado").slice(0, 5);
        const latestContractDispatch = contractHistory[0];
        const lastContractChannel = latestContractDispatch?.description.includes("via e-mail") ? "email" : "whatsapp";
        return <details className="traffic-lead-card" key={lead.id} open={leadExpansion[lead.id] ?? (lead.id === latestSiteLeadId)} onToggle={(event) => { const isOpen = event.currentTarget.open; setLeadExpansion((current) => ({ ...current, [lead.id]: isOpen })); }}><summary className="traffic-lead-summary"><div><span className="vallex-admin-eyebrow">{lead.audience === "prestador" ? "Prestador VALLEX" : lead.audience === "cliente" ? "Cliente" : "Contato recebido pelo site"}</span><strong>{lead.organization_name || lead.name}</strong><small>{lead.phone}{lead.responsible_name ? ` · Responsável: ${lead.responsible_name}` : ""}</small></div><span className="traffic-lead-summary-meta">{pipelineLabels[lead.status] ?? lead.status} · {localDate(lead.created_at)}<b>{(leadExpansion[lead.id] ?? (lead.id === latestSiteLeadId)) ? "Encolher cadastro" : "Ver cadastro"}</b></span></summary><div className="traffic-lead-detail">
          <div className="traffic-lead-head"><div><span className="vallex-admin-eyebrow">{lead.audience === "prestador" ? "Prestador VALLEX" : lead.audience === "cliente" ? "Cliente" : "Visitante"}{lead.plan_code ? ` · ${lead.plan_code}` : ""}</span><h3>{lead.name}</h3><small>{localDate(lead.created_at)}{lead.organization_name ? ` · ${lead.organization_name}` : ""}{lead.responsible_name ? ` · Responsável: ${lead.responsible_name}` : ""}</small></div><div className="traffic-lead-contact"><a href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}>{lead.phone}</a>{lead.email && <a href={`mailto:${lead.email}`}>{lead.email}</a>}{whatsappHref(lead.phone, `Olá, ${lead.name}! Aqui é da VALLEX. Estou acompanhando seu interesse em tráfego pago. Como podemos avançar?`) && <a className="traffic-whatsapp-button" href={whatsappHref(lead.phone, `Olá, ${lead.name}! Aqui é da VALLEX. Estou acompanhando seu interesse em tráfego pago. Como podemos avançar?`) ?? undefined} target="_blank" rel="noreferrer">Conversar pelo WhatsApp</a>}</div></div>
          <p className="traffic-lead-need">{lead.need_description}</p>
          <div className="traffic-attribution">Origem: {lead.utm_source || lead.source || "direta"}{lead.utm_medium ? ` · ${lead.utm_medium}` : ""}{lead.utm_campaign ? ` · campanha ${lead.utm_campaign}` : ""}{lead.utm_content ? ` · conteúdo ${lead.utm_content}` : ""}{lead.utm_term ? ` · termo ${lead.utm_term}` : ""}{lead.referrer ? ` · veio de ${lead.referrer}` : ""}</div>
          <fieldset disabled={!permissions.manage_leads}><div className="traffic-lead-fields">
            <label>Etapa<select value={draft.status} onChange={(event) => setLeadDrafts((current) => ({ ...current, [lead.id]: { ...draft, status: event.target.value } }))}>{pipeline.map((status) => <option key={status} value={status}>{pipelineLabels[status]}</option>)}</select></label>
            <label>Valor da gestão (R$)<CurrencyInput min={0} value={draft.serviceValue} onChange={(serviceValue) => setLeadDrafts((current) => ({ ...current, [lead.id]: { ...draft, serviceValue } }))} /></label>
            <label>Orçamento de mídia (R$)<CurrencyInput min={0} value={draft.mediaBudget} onChange={(mediaBudget) => setLeadDrafts((current) => ({ ...current, [lead.id]: { ...draft, mediaBudget } }))} /></label>
            <label>Responsável<input maxLength={160} value={draft.responsibleName} onChange={(event) => setLeadDrafts((current) => ({ ...current, [lead.id]: { ...draft, responsibleName: event.target.value } }))} /></label>
            <label>Link do Facebook<input type="url" maxLength={500} placeholder="https://facebook.com/..." value={draft.facebookUrl} onChange={(event) => setLeadDrafts((current) => ({ ...current, [lead.id]: { ...draft, facebookUrl: event.target.value } }))} /></label>
            <label>Link do Instagram<input type="url" maxLength={500} placeholder="https://instagram.com/..." value={draft.instagramUrl} onChange={(event) => setLeadDrafts((current) => ({ ...current, [lead.id]: { ...draft, instagramUrl: event.target.value } }))} /></label>
            <label className="traffic-lead-event">Registro da negociação<input maxLength={2000} placeholder="Ex.: reunião marcada, proposta enviada, retorno combinado…" value={draft.event} onChange={(event) => setLeadDrafts((current) => ({ ...current, [lead.id]: { ...draft, event: event.target.value } }))} /></label>
            <button className="vallex-admin-primary" type="button" disabled={saving === `lead-${lead.id}`} onClick={() => void requestApi("PATCH", { kind: "lead", id: lead.id, status: draft.status, serviceValue: draft.serviceValue || null, mediaBudget: draft.mediaBudget || null, responsibleName: draft.responsibleName, facebookUrl: draft.facebookUrl, instagramUrl: draft.instagramUrl, event: draft.event }, `lead-${lead.id}`)}>{saving === `lead-${lead.id}` ? "Salvando…" : "Salvar e registrar"}</button>
          </div></fieldset>
          <section className="traffic-contract-box" aria-label={`Contrato de ${lead.name}`}>
            <div><strong>Contrato em PDF</strong><p>Selecione o contrato no seu dispositivo e escolha um canal. O PDF só será compartilhado se o navegador oferecer compartilhamento de arquivos; caso contrário, o painel avisará que é necessário configurar uma integração de envio. O cliente pode assinar pelo gov.br e devolver o PDF assinado. A VALLEX guarda somente a versão assinada.</p></div>
            {lead.signed_contract_path && <div className="traffic-signed-contract"><span>Assinado recebido: {lead.signed_contract_name ?? "contrato-assinado.pdf"}{lead.signed_contract_at ? ` · ${localDate(lead.signed_contract_at)}` : ""}</span><div className="traffic-contract-actions"><button className="vallex-admin-secondary" type="button" disabled={!permissions.manage_leads || saving === `open-contract-${lead.id}`} onClick={() => void openSignedContract(lead.id)}>{saving === `open-contract-${lead.id}` ? "Abrindo…" : "Abrir PDF assinado"}</button><button className="vallex-admin-secondary traffic-delete-contract" type="button" disabled={!permissions.manage_leads || saving === `delete-contract-${lead.id}`} onClick={() => void deleteSignedContract(lead)}>{saving === `delete-contract-${lead.id}` ? "Excluindo…" : "Excluir arquivo errado"}</button></div></div>}
            <div className="traffic-contract-actions">
              {(!latestContractDispatch || contractReady[lead.id]) && <label className="vallex-admin-secondary traffic-file-label">Selecionar contrato PDF<input type="file" accept="application/pdf,.pdf" disabled={!permissions.manage_leads} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) selectContractFile(lead.id, file); }} /></label>}
              {contractReady[lead.id] && contractFiles[lead.id] && <div className="traffic-contract-send-actions"><span>Selecionado: <strong>{contractFiles[lead.id]?.name}</strong></span><button className="vallex-admin-primary" type="button" disabled={!permissions.manage_leads} onClick={() => void shareContract(lead, "whatsapp")}>Compartilhar PDF pelo WhatsApp</button><button className="vallex-admin-secondary" type="button" disabled={!permissions.manage_leads || !lead.email} onClick={() => void prepareContractEmail(lead)}>Compartilhar PDF por e-mail</button><button className="vallex-admin-secondary" type="button" disabled={!permissions.manage_leads} onClick={() => clearSelectedContract(lead.id)}>Remover seleção</button>{!lead.email && <small>Sem e-mail cadastrado</small>}</div>}
              <label className="vallex-admin-secondary traffic-file-label">Anexar PDF assinado<input type="file" accept="application/pdf,.pdf" disabled={!permissions.manage_leads || saving === `contract-${lead.id}`} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadSignedContract(lead.id, file); }} /></label>
              {saving === `contract-${lead.id}` && <span role="status">Guardando PDF assinado…</span>}
            </div>
          </section>
          {contractHistory.length > 0 && <details className="traffic-history"><summary>Histórico de enviados ({contractHistory.length} recentes)</summary><ul>{contractHistory.map((item) => <li key={item.id}><time>{localDate(item.created_at)}</time> {item.description}</li>)}</ul><div className="traffic-contract-actions mt-3">{lastSentContractFiles[lead.id] && <button className="vallex-admin-secondary" type="button" disabled={!permissions.manage_leads} onClick={() => void shareContract(lead, lastContractChannel, true, lastSentContractFiles[lead.id] ?? undefined)}>Reenviar último contrato</button>}<label className="vallex-admin-secondary traffic-file-label">{lastSentContractFiles[lead.id] ? "Selecionar outro PDF" : "Selecionar PDF para reenviar"}<input type="file" accept="application/pdf,.pdf" disabled={!permissions.manage_leads} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) selectContractFile(lead.id, file); }} /></label><small>O PDF de envio não fica armazenado pela VALLEX; após sair desta sessão, selecione o arquivo novamente para reenviar.</small></div></details>}
          {history.length > 0 && <details className="traffic-history"><summary>Histórico ({history.length} registros recentes)</summary><ul>{history.map((item) => <li key={item.id}><time>{localDate(item.created_at)}</time> {item.description}</li>)}</ul></details>}
        </div></details>;
      })}</div>}
    </section>

    <section className="vallex-admin-section"><div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Acompanhamento</span><h2>Campanhas e indicadores</h2><p>Registre o escopo e atualize os números consultados nas plataformas de anúncios. Estes dados não são sincronizados automaticamente.</p></div></div>
      <form className="traffic-campaign-form" onSubmit={async (event) => { event.preventDefault(); const saved = await requestApi("POST", { kind: "campaign", ...campaignForm }, "new-campaign"); if (saved) setCampaignForm((current) => ({ ...current, name: "", channel: "Google Ads", startDate: "", endDate: "", mediaBudget: "", notes: "" })); }}><fieldset disabled={!permissions.manage_campaigns}>
        <label>Cliente<select required value={campaignForm.leadId} onChange={(event) => setCampaignForm((current) => ({ ...current, leadId: event.target.value, name: "", channel: "Google Ads", startDate: "", endDate: "", mediaBudget: "", notes: "" }))}><option value="">Selecione</option>{data.leads.map((lead) => <option value={lead.id} key={lead.id}>{lead.organization_name || lead.name}</option>)}{data.archivedLeads.map((lead) => <option value={lead.id} key={lead.id}>Encerrado · {lead.organization_name || lead.name}</option>)}</select></label>
        <label>Campanha<input required maxLength={160} value={campaignForm.name} onChange={(event) => setCampaignForm({ ...campaignForm, name: event.target.value })} /></label>
        <label>Canal<select value={campaignForm.channel} onChange={(event) => setCampaignForm({ ...campaignForm, channel: event.target.value })}><option>Google Ads</option><option>Meta Ads</option><option>Outro</option></select></label>
        <label>Orçamento de mídia (R$)<CurrencyInput min={0} value={campaignForm.mediaBudget} onChange={(mediaBudget) => setCampaignForm({ ...campaignForm, mediaBudget })} /></label>
        <label>Início<input type="date" value={campaignForm.startDate} onChange={(event) => setCampaignForm({ ...campaignForm, startDate: event.target.value })} /></label>
        <label>Fim previsto<input type="date" value={campaignForm.endDate} onChange={(event) => setCampaignForm({ ...campaignForm, endDate: event.target.value })} /></label>
        <label className="traffic-full">Escopo / observações<textarea rows={2} maxLength={2000} value={campaignForm.notes} onChange={(event) => setCampaignForm({ ...campaignForm, notes: event.target.value })} /></label>
        <button className="vallex-admin-primary" type="submit" disabled={saving === "new-campaign" || data.leads.length === 0 || Boolean(selectedClient?.archived_at)}>{saving === "new-campaign" ? "Registrando…" : "Registrar campanha"}</button>
      </fieldset></form>
      {selectedClient?.archived_at && <p className="vallex-admin-empty mt-3">Este cliente está encerrado. O histórico permanece disponível; reative o cadastro para registrar novas campanhas.</p>}
      {!campaignForm.leadId ? <p className="vallex-admin-empty mt-4">Selecione um cliente para ver o histórico das campanhas.</p> : selectedClientCampaigns.length === 0 ? <p className="vallex-admin-empty mt-4">Ainda não há campanhas cadastradas para {selectedClient?.organization_name || selectedClient?.name || "este cliente"}.</p> : <section className="traffic-client-campaign-history"><h3>Histórico de campanhas · {selectedClient?.organization_name || selectedClient?.name}</h3><div className="traffic-campaign-list">{selectedClientCampaigns.map((campaign) => {
        const draft = campaignDrafts[campaign.id] ?? { status: campaign.status, amountSpent: moneyInput(campaign.amount_spent), impressions: numberInput(campaign.impressions), clicks: numberInput(campaign.clicks), leadsGenerated: numberInput(campaign.leads_generated), conversions: numberInput(campaign.conversions), notes: campaign.notes ?? "" };
        const lead = allLeads.find((item) => item.id === campaign.lead_id);
        return <details className="traffic-campaign-card" key={campaign.id}><summary className="traffic-campaign-summary"><header><div><h3>{campaign.name}</h3><p>{lead?.organization_name || lead?.name || "Cliente removido"} · {campaign.channel} · mídia prevista {currency.format(campaign.media_budget)}</p></div><span className="vallex-admin-badge">{campaignLabels[draft.status] ?? draft.status}</span></header><small>{campaign.start_date ? localCalendarDate(campaign.start_date) : "Início não definido"}{campaign.end_date ? ` · até ${localCalendarDate(campaign.end_date)}` : " · sem fim previsto"} · Gasto {currency.format(campaign.amount_spent)} · {campaign.impressions} impressões · {campaign.clicks} cliques · {campaign.leads_generated} leads · {campaign.conversions} conversões</small><b>Editar indicadores</b></summary>
          <fieldset disabled={!permissions.manage_campaigns}><div className="traffic-campaign-metrics"><label>Status<select value={draft.status} onChange={(event) => setCampaignDrafts((current) => ({ ...current, [campaign.id]: { ...draft, status: event.target.value } }))}>{Object.keys(campaignLabels).map((status) => <option key={status} value={status}>{campaignLabels[status]}</option>)}</select></label>
            {([ ["amountSpent", "Gasto (R$)"], ["impressions", "Impressões"], ["clicks", "Cliques"], ["leadsGenerated", "Leads"], ["conversions", "Conversões"] ] as const).map(([key, label]) => <label key={key}>{label}{key === "amountSpent" ? <CurrencyInput min={0} value={draft.amountSpent} onChange={(amountSpent) => setCampaignDrafts((current) => ({ ...current, [campaign.id]: { ...draft, amountSpent } }))} /> : <input type="number" min="0" step="1" value={draft[key]} onChange={(event) => setCampaignDrafts((current) => ({ ...current, [campaign.id]: { ...draft, [key]: event.target.value } }))} />}</label>)}
            <label className="traffic-full">Notas<textarea rows={2} value={draft.notes} onChange={(event) => setCampaignDrafts((current) => ({ ...current, [campaign.id]: { ...draft, notes: event.target.value } }))} /></label>
          </div><button type="button" className="vallex-admin-secondary mt-3" disabled={saving === `campaign-${campaign.id}`} onClick={() => void requestApi("PATCH", { kind: "campaign", id: campaign.id, status: draft.status, amountSpent: draft.amountSpent || 0, impressions: draft.impressions || 0, clicks: draft.clicks || 0, leadsGenerated: draft.leadsGenerated || 0, conversions: draft.conversions || 0, notes: draft.notes }, `campaign-${campaign.id}`)}>{saving === `campaign-${campaign.id}` ? "Salvando…" : "Atualizar indicadores"}</button></fieldset>
        </details>;
      })}</div></section>}
      <p className="traffic-disclaimer">O investimento em mídia é separado do valor da gestão da VALLEX e deve ser pago pelo cliente à plataforma de anúncios.</p>
    </section>
  </div>;
}
