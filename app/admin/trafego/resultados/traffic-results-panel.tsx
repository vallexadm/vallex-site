"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Lead = { id: string; name: string; organization_name: string | null; facebook_url: string | null; instagram_url: string | null };
type Campaign = { id: string; lead_id: string; name: string; channel: string; status: string; start_date: string | null; end_date: string | null; media_budget: number; amount_spent: number; impressions: number; clicks: number; leads_generated: number; conversions: number };
type Snapshot = { id: string; campaign_id: string; recorded_at: string; amount_spent: number; impressions: number; clicks: number; leads_generated: number; conversions: number; status: string };
type MetricKey = "amount_spent" | "impressions" | "clicks" | "leads_generated" | "conversions";

const metricOptions: { key: MetricKey; label: string; format: (value: number) => string }[] = [
  { key: "amount_spent", label: "Gasto de mídia (R$)", format: (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value) },
  { key: "impressions", label: "Impressões", format: (value) => Math.round(value).toLocaleString("pt-BR") },
  { key: "clicks", label: "Cliques", format: (value) => Math.round(value).toLocaleString("pt-BR") },
  { key: "leads_generated", label: "Leads", format: (value) => Math.round(value).toLocaleString("pt-BR") },
  { key: "conversions", label: "Conversões", format: (value) => Math.round(value).toLocaleString("pt-BR") },
];
const colors = ["#c084fc", "#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#a5b4fc", "#2dd4bf", "#f472b6"];
const statusLabels: Record<string, string> = { planejada: "Planejada", ativa: "Ativa", pausada: "Pausada", concluida: "Concluída" };
const compactDate = (value: string) => new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const periodDate = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { dateStyle: "medium" }) : "Não informado";

export default function TrafficResultsPanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [leadId, setLeadId] = useState("");
  const [campaignId, setCampaignId] = useState("all");
  const [metric, setMetric] = useState<MetricKey>("impressions");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Entre em uma conta autorizada para consultar os resultados.");
      const response = await fetch("/api/admin/trafego", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível carregar os resultados.");
      const nextLeads: Lead[] = result.leads ?? [];
      const nextCampaigns: Campaign[] = result.campaigns ?? [];
      setLeads(nextLeads); setCampaigns(nextCampaigns); setSnapshots(result.snapshots ?? []);
      setLeadId((current) => current || nextCampaigns[0]?.lead_id || "");
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Falha ao carregar os resultados."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const availableLeads = useMemo(() => leads.filter((lead) => campaigns.some((campaign) => campaign.lead_id === lead.id)), [leads, campaigns]);
  const selectedLead = leads.find((lead) => lead.id === leadId);
  const leadCampaigns = campaigns.filter((campaign) => campaign.lead_id === leadId);
  const visibleCampaigns = leadCampaigns.filter((campaign) => campaignId === "all" || campaign.id === campaignId);
  const selectedMetric = metricOptions.find((item) => item.key === metric)!;
  const series = visibleCampaigns.map((campaign, index) => ({ campaign, color: colors[index % colors.length], points: snapshots.filter((point) => point.campaign_id === campaign.id).slice().sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at)) }));
  const points = series.flatMap((item) => item.points.map((point) => ({ at: Date.parse(point.recorded_at), value: Number(point[metric]) || 0 })));
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const minTime = Math.min(...points.map((point) => point.at));
  const maxTime = Math.max(...points.map((point) => point.at));
  const xFor = (time: number) => points.length < 2 || minTime === maxTime ? 430 : 64 + ((time - minTime) / (maxTime - minTime)) * 758;
  const yFor = (value: number) => 286 - (value / maxValue) * 238;
  const totalSnapshots = series.reduce((sum, item) => sum + item.points.length, 0);

  if (loading) return <p className="vallex-admin-empty">Carregando resultados das campanhas…</p>;

  return <div className="traffic-results">
    <section className="traffic-results-filters" aria-label="Filtros dos resultados">
      <label>Cliente<select value={leadId} onChange={(event) => { setLeadId(event.target.value); setCampaignId("all"); }}><option value="">Selecione um cliente</option>{availableLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.organization_name || lead.name}</option>)}</select></label>
      <label>Campanha<select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} disabled={!leadId}><option value="all">Todas as campanhas do cliente</option>{leadCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} · {campaign.channel}</option>)}</select></label>
      <label>Indicador<select value={metric} onChange={(event) => setMetric(event.target.value as MetricKey)}>{metricOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      <button className="vallex-admin-secondary" type="button" onClick={() => void load()}>Atualizar dados</button>
    </section>
    {error && <p className="vallex-admin-error" role="alert">{error}<span className="block mt-2">Confira se as colunas sociais e a tabela de histórico estão na estrutura do módulo de tráfego do Supabase.</span></p>}
    {!error && availableLeads.length === 0 && <p className="vallex-admin-empty">As campanhas registradas aparecerão aqui depois de criadas na gestão de tráfego.</p>}
    {selectedLead && <>
      <section className="traffic-results-client">
        <div><span className="vallex-admin-eyebrow">Cliente acompanhado</span><h2>{selectedLead.organization_name || selectedLead.name}</h2><p>{leadCampaigns.length} campanha(s) cadastrada(s)</p></div>
        <div className="traffic-social-links">{selectedLead.facebook_url ? <a href={selectedLead.facebook_url} target="_blank" rel="noopener noreferrer">Facebook ↗</a> : <span>Facebook não informado</span>}{selectedLead.instagram_url ? <a href={selectedLead.instagram_url} target="_blank" rel="noopener noreferrer">Instagram ↗</a> : <span>Instagram não informado</span>}</div>
      </section>
      {leadCampaigns.length > 0 && <section className="traffic-results-periods" aria-label="Períodos das campanhas"><h2>Campanhas e períodos</h2><div className="traffic-results-campaign-list">{visibleCampaigns.map((campaign, index) => <article key={campaign.id}><div className="traffic-results-campaign-title"><i style={{ background: colors[index % colors.length] }} /><div><h3>{campaign.name}</h3><p>{campaign.channel} · {statusLabels[campaign.status] ?? campaign.status}</p></div></div><p>Início: <strong>{periodDate(campaign.start_date)}</strong></p><p>Fim previsto: <strong>{periodDate(campaign.end_date)}</strong></p><p>Atividade: <strong>{campaign.status === "ativa" ? "Em andamento" : campaign.status === "concluida" ? "Concluída" : campaign.status === "pausada" ? "Pausada" : "Ainda não iniciada"}</strong></p></article>)}</div></section>}
      {visibleCampaigns.length > 0 && <section className="traffic-results-chart-card"><div className="traffic-results-chart-heading"><div><span className="vallex-admin-eyebrow">Evolução registrada</span><h2>{selectedMetric.label}</h2><p>Valores acompanhados nas atualizações de cada campanha.</p></div><strong>{totalSnapshots} registro(s) histórico(s)</strong></div>
        {totalSnapshots === 0 ? <p className="vallex-admin-empty">Ainda não há atualizações de indicadores para exibir. Registre os primeiros resultados na gestão de tráfego.</p> : <>
          <div className="vallex-admin-chart-scroll"><svg className="traffic-results-svg" viewBox="0 0 860 340" role="img" aria-label={`Gráfico da evolução de ${selectedMetric.label}`}>
            {[0, 1, 2, 3, 4].map((step) => { const value = (maxValue * step) / 4; const y = yFor(value); return <g key={step}><line x1="64" x2="822" y1={y} y2={y} className="vallex-admin-chart-grid" /><text x="54" y={y + 4} textAnchor="end" className="vallex-admin-chart-axis">{selectedMetric.format(value)}</text></g>; })}
            {minTime !== undefined && maxTime !== undefined && <><text x="64" y="317" className="vallex-admin-chart-axis">{compactDate(new Date(minTime).toISOString())}</text><text x="822" y="317" textAnchor="end" className="vallex-admin-chart-axis">{compactDate(new Date(maxTime).toISOString())}</text></>}
            {series.map(({ campaign, color, points: campaignPoints }) => { const coordinates = campaignPoints.map((point) => `${xFor(Date.parse(point.recorded_at))},${yFor(Number(point[metric]) || 0)}`).join(" "); return <g key={campaign.id}><polyline points={coordinates} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />{campaignPoints.map((point) => <circle key={point.id} cx={xFor(Date.parse(point.recorded_at))} cy={yFor(Number(point[metric]) || 0)} r="5" fill={color}><title>{campaign.name} · {compactDate(point.recorded_at)} · {selectedMetric.format(Number(point[metric]) || 0)}</title></circle>)}</g>; })}
          </svg></div>
          <div className="vallex-admin-chart-legend">{series.map(({ campaign, color }) => <span key={campaign.id}><i style={{ background: color }} />{campaign.name}</span>)}</div>
          <p className="traffic-results-note">A evolução começa a partir dos indicadores lançados pela equipe na plataforma. Os dados não são importados automaticamente das contas de anúncios.</p>
        </>}
      </section>}
      {visibleCampaigns.map((campaign) => { const latest = snapshots.filter((point) => point.campaign_id === campaign.id).slice().sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at))[0]; return <article className="traffic-results-latest" key={campaign.id}><h3>{campaign.name} <span>{campaign.channel}</span></h3><div><span>Gasto <strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(latest?.amount_spent ?? campaign.amount_spent))}</strong></span><span>Impressões <strong>{Number(latest?.impressions ?? campaign.impressions).toLocaleString("pt-BR")}</strong></span><span>Cliques <strong>{Number(latest?.clicks ?? campaign.clicks).toLocaleString("pt-BR")}</strong></span><span>Leads <strong>{Number(latest?.leads_generated ?? campaign.leads_generated).toLocaleString("pt-BR")}</strong></span><span>Conversões <strong>{Number(latest?.conversions ?? campaign.conversions).toLocaleString("pt-BR")}</strong></span></div></article>; })}
    </>}
  </div>;
}
