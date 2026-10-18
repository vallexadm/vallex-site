"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { SUPPORT_TOOLS, supportOriginLabel } from "@/lib/support-tools";
import MetricsDashboard, { type MetricData } from "./metrics-dashboard";

type ContactStatus = "novo" | "em_contato" | "orcamento_enviado" | "agendado" | "concluido" | "cancelado";
type Contact = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  servico: string;
  descricao: string;
  data_preferida: string | null;
  horario_preferido: string | null;
  sugestao_futura: string | null;
  status: ContactStatus;
  criado_em: string;
  origem: "site" | "acesso_prestador";
  organization_id: string | null;
  solicitante_id: string | null;
  ferramenta: string | null;
  plano_codigo: string | null;
  plano_nome: string | null;
};
type Provider = {
  id: string;
  name: string;
  businessType: string | null;
  createdAt: string;
  profile: null | { slug: string; displayName: string; published: boolean; canRepublish: boolean; serviceArea: string | null; updatedAt: string; removedAt: string | null; removedBy: string | null; removalReason: string | null };
  subscription: null | { status: string; currentPeriodEnd: string | null; plan: string; planCode: string };
};
type ProviderDraft = { displayName: string; serviceArea: string };
type TrafficSummary = { leads: number; pendingLeads: number; activeCampaigns: number; spend: number };
type SalesSummary = { customers: number; closed: number; waiting: number; activeContracts: number; monthlyRevenue: number; byProduct: { product: string; label: string; closed: number; waiting: number; activeContracts: number; monthlyRevenue: number }[] };
type AdminPermissions = Record<string, Record<string, boolean>>;

const statuses: { value: ContactStatus; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "em_contato", label: "Em contato" },
  { value: "orcamento_enviado", label: "Orçamento enviado" },
  { value: "agendado", label: "Agendado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

function formattedDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { dateStyle: "medium" });
}

export default function VallexAdminPage() {
  const [tab, setTab] = useState<"overview" | "providers" | "support">("overview");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerListMode, setProviderListMode] = useState<"active" | "excluded">("active");
  const [editingProviderId, setEditingProviderId] = useState("");
  const [removingProviderId, setRemovingProviderId] = useState("");
  const [removalReason, setRemovalReason] = useState("");
  const [providerDraft, setProviderDraft] = useState<ProviderDraft>({ displayName: "", serviceArea: "" });
  const [providerMessage, setProviderMessage] = useState("");
  const [trafficSummary, setTrafficSummary] = useState<TrafficSummary | null>(null);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [metricData, setMetricData] = useState<MetricData | null>(null);
  const [metricsRefreshing, setMetricsRefreshing] = useState(false);
  const [permissions, setPermissions] = useState<AdminPermissions>({});
  const [isOwner, setIsOwner] = useState(false);
  const [filter, setFilter] = useState("");
  const [supportOriginFilter, setSupportOriginFilter] = useState<"all" | "site" | "acesso_prestador">("all");
  const [supportToolFilter, setSupportToolFilter] = useState("all");
  const [supportPlanFilter, setSupportPlanFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const refreshMetrics = useCallback(async () => {
    setMetricsRefreshing(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/admin/metricas", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível atualizar os indicadores.");
      setMetricData(result as MetricData);
    } catch (metricsError) {
      setMetricData({
        series: { providers: [], requests: [], subscriptions: [], trafficLeads: [], campaigns: [] },
        visible: { providers: false, requests: false, subscriptions: false, trafficLeads: false, campaigns: false },
        warnings: [metricsError instanceof Error ? metricsError.message : "Falha ao atualizar os indicadores"],
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setMetricsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (accessDenied) return;
    const timer = window.setTimeout(() => { void refreshMetrics(); }, 0);
    const interval = window.setInterval(() => void refreshMetrics(), 60_000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, [accessDenied, refreshMetrics]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${accessToken}` };
    try {
      const accessResponse = await fetch("/api/admin/access", { headers, cache: "no-store" });
      const accessResult = await accessResponse.json();
      if (!accessResponse.ok || (!accessResult.isAdmin && !accessResult.isStaff)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      const grants = accessResult.permissions ?? {};
      setPermissions(grants);
      setIsOwner(accessResult.isAdmin === true);
      const [contactsResponse, providersResponse, trafficResponse, salesResponse] = await Promise.all([
        accessResult.isAdmin || grants.support?.view ? fetch("/api/contatos", { headers, cache: "no-store" }) : Promise.resolve(null),
        accessResult.isAdmin || grants.providers?.view ? fetch("/api/admin/prestadores", { headers, cache: "no-store" }) : Promise.resolve(null),
        accessResult.isAdmin || grants.traffic?.view ? fetch("/api/admin/trafego/resumo", { headers, cache: "no-store" }) : Promise.resolve(null),
        accessResult.isAdmin || grants.sales?.view ? fetch("/api/admin/vendas/resumo", { headers, cache: "no-store" }) : Promise.resolve(null),
      ]);
      const [contactsResult, providersResult, trafficResult, salesResult] = await Promise.all([
        contactsResponse ? contactsResponse.json() : null,
        providersResponse ? providersResponse.json() : null,
        trafficResponse?.ok ? trafficResponse.json() : null,
        salesResponse?.ok ? salesResponse.json() : null,
      ]);
      if (contactsResponse && (!contactsResponse.ok || !contactsResult?.ok)) throw new Error(contactsResult?.message ?? "Não foi possível carregar o suporte.");
      if (providersResponse && (!providersResponse.ok || !providersResult?.ok)) throw new Error(providersResult?.message ?? "Não foi possível carregar os prestadores.");
      setContacts(contactsResult?.contatos ?? []);
      setProviders(providersResult?.providers ?? []);
      setTrafficSummary(trafficResult?.ok ? trafficResult : null);
      setSalesSummary(salesResult?.ok ? salesResult.summary : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar os dados administrativos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void loadData(); }, 0); return () => window.clearTimeout(timer); }, [loadData]);

  async function handleLogout() {
    setSigningOut(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setSigningOut(false);
      setError("Não foi possível encerrar a sessão. Tente novamente.");
      return;
    }
    window.location.replace("/sistema/login");
  }

  const visibleContacts = useMemo(() => {
    const normalized = filter.trim().toLocaleLowerCase("pt-BR");
    return contacts.filter((contact) => {
      if (supportOriginFilter !== "all" && contact.origem !== supportOriginFilter) return false;
      if (supportToolFilter !== "all" && contact.ferramenta !== supportToolFilter) return false;
      if (supportPlanFilter !== "all" && (contact.plano_codigo ?? "site") !== supportPlanFilter) return false;
      if (!normalized) return true;
      return [contact.nome, contact.servico, contact.telefone, contact.email ?? "", contact.ferramenta ?? "", contact.plano_nome ?? ""]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(normalized));
    });
  }, [contacts, filter, supportOriginFilter, supportToolFilter, supportPlanFilter]);

  const activeProviders = providers.filter((provider) => !provider.profile?.removedAt);
  const excludedProviders = providers.filter((provider) => Boolean(provider.profile?.removedAt));
  const providersToShow = providerListMode === "active" ? activeProviders : excludedProviders;
  const supportPlans = Array.from(new Map<string, string>(contacts.flatMap((contact): [string, string][] => contact.plano_codigo ? [[contact.plano_codigo, contact.plano_nome ?? contact.plano_codigo]] : [])).entries());

  async function updateContactStatus(contact: Contact, status: ContactStatus) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return setError("Sua sessão expirou. Entre novamente.");
    setBusyId(contact.id);
    setError("");
    try {
      const response = await fetch("/api/contatos", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: contact.id, status }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível atualizar o atendimento.");
      setContacts((current) => current.map((item) => item.id === contact.id ? { ...item, status } : item));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Falha ao atualizar o atendimento.");
    } finally {
      setBusyId("");
    }
  }

  function beginProviderEdit(provider: Provider) {
    if (!provider.profile) return;
    setProviderDraft({ displayName: provider.profile.displayName, serviceArea: provider.profile.serviceArea ?? "" });
    setEditingProviderId(provider.id);
    setProviderMessage("");
    setError("");
  }

  async function updateProvider(provider: Provider) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return setError("Sua sessão expirou. Entre novamente.");
    setBusyId(provider.id);
    setError("");
    setProviderMessage("");
    try {
      const response = await fetch("/api/admin/prestadores", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: provider.id, action: "edit", ...providerDraft }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível atualizar a vitrine.");
      setProviders((current) => current.map((item) => item.id === provider.id && item.profile
        ? { ...item, profile: { ...item.profile, displayName: providerDraft.displayName.trim(), serviceArea: providerDraft.serviceArea.trim() || null, updatedAt: new Date().toISOString() } }
        : item));
      setEditingProviderId("");
      setProviderMessage(`Vitrine de ${providerDraft.displayName.trim()} atualizada.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Falha ao atualizar a vitrine.");
    } finally {
      setBusyId("");
    }
  }

  async function setProviderVisibility(provider: Provider, published: boolean) {
    if (!provider.profile) return;
    if (!published && !window.confirm(`Ocultar a vitrine de ${provider.profile.displayName}? Ela poderá ser reexibida pelo painel.`)) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return setError("Sua sessão expirou. Entre novamente.");
    setBusyId(provider.id);
    setError("");
    setProviderMessage("");
    try {
      const response = await fetch("/api/admin/prestadores", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: provider.id, action: "visibility", published }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível alterar a visibilidade da vitrine.");
      setProviders((current) => current.map((item) => item.id === provider.id && item.profile
        ? { ...item, profile: { ...item.profile, published, canRepublish: !published } }
        : item));
      setProviderMessage(published ? "Vitrine reexibida." : "Vitrine ocultada do público.");
    } catch (visibilityError) {
      setError(visibilityError instanceof Error ? visibilityError.message : "Falha ao alterar a visibilidade da vitrine.");
    } finally {
      setBusyId("");
    }
  }

  function beginProviderRemoval(provider: Provider) {
    setEditingProviderId("");
    setRemovingProviderId(provider.id);
    setRemovalReason("");
    setError("");
  }

  async function removeProviderVitrine(provider: Provider) {
    if (!provider.profile || removalReason.trim().length < 3) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return setError("Sua sessão expirou. Entre novamente.");
    setBusyId(provider.id);
    setError("");
    setProviderMessage("");
    try {
      const response = await fetch("/api/admin/prestadores", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: provider.id, reason: removalReason.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível remover a vitrine.");
      setProviders((current) => current.map((item) => item.id === provider.id && item.profile
        ? { ...item, profile: { ...item.profile, published: false, canRepublish: false, removedAt: result.removedAt ?? new Date().toISOString(), removalReason: result.reason ?? removalReason.trim() } }
        : item));
      setRemovingProviderId("");
      setRemovalReason("");
      setProviderMessage(result.message ?? "Perfil removido da vitrine. A conta e os serviços foram preservados.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Falha ao remover a vitrine.");
    } finally {
      setBusyId("");
    }
  }

  async function restoreProviderVitrine(provider: Provider) {
    if (!provider.profile?.removedAt) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return setError("Sua sessão expirou. Entre novamente.");
    setBusyId(provider.id);
    setError("");
    setProviderMessage("");
    try {
      const response = await fetch("/api/admin/prestadores", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: provider.id, action: "restore" }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível restaurar o prestador.");
      setProviders((current) => current.map((item) => item.id === provider.id && item.profile
        ? { ...item, profile: { ...item.profile, published: false, canRepublish: true, removedAt: null, removedBy: null, removalReason: null, updatedAt: new Date().toISOString() } }
        : item));
      setProviderMessage(result.message ?? "Prestador restaurado para a lista de ativos.");
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Falha ao restaurar o prestador.");
    } finally {
      setBusyId("");
    }
  }

  const pendingSupport = contacts.filter((item) => !["concluido", "cancelado"].includes(item.status)).length;
  const publishedProviders = providers.filter((provider) => provider.profile?.published).length;
  const activePaidSubscriptions = providers.filter((provider) =>
    provider.subscription?.status === "active" && provider.subscription.planCode !== "free" && provider.subscription.planCode !== "unknown"
  ).length;
  const activeFreeSubscriptions = providers.filter((provider) =>
    provider.subscription?.status === "active" && provider.subscription.planCode === "free"
  ).length;
  const paidPlanCounts = providers.reduce<Map<string, { name: string; count: number }>>((counts, provider) => {
    const subscription = provider.subscription;
    if (!subscription || subscription.status !== "active" || subscription.planCode === "free" || subscription.planCode === "unknown") return counts;
    const current = counts.get(subscription.planCode);
    counts.set(subscription.planCode, { name: current?.name ?? subscription.plan, count: (current?.count ?? 0) + 1 });
    return counts;
  }, new Map());

  if (loading) return <main className="vallex-admin-page"><div className="vallex-admin-shell"><p className="vallex-admin-muted">Carregando administração da VALLEX…</p></div></main>;

  if (accessDenied) return (
    <main className="vallex-admin-page">
      <div className="vallex-admin-shell vallex-admin-access">
        <span className="vallex-admin-eyebrow">Portal interno VALLEX</span>
        <h1>Acesso da equipe</h1>
        <p>Proprietário, sócios e funcionários cadastrados entram por aqui. O proprietário organiza cargos e permissões em um só lugar, no painel <strong>Equipe e permissões</strong>. Cada integrante acessa somente as áreas liberadas para sua função.</p>
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <h2 className="font-semibold text-slate-100">Primeiro acesso?</h2>
          <p className="mb-0 mt-2 text-sm text-slate-300">Peça ao proprietário para cadastrar seu nome, cargo e e-mail. Depois, crie sua conta pelo link interno da equipe usando esse mesmo e-mail. A conta de prestador não libera o Administrativo VALLEX.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="vallex-admin-primary" href="/sistema/login?next=%2Fadmin">Entrar como equipe VALLEX</Link>
          <button className="vallex-admin-back" type="button" onClick={() => void handleLogout()} disabled={signingOut}>
            {signingOut ? "Saindo…" : "Sair da conta atual"}
          </button>
          <Link className="vallex-admin-back" href="/">Voltar ao site</Link>
        </div>
      </div>
    </main>
  );

  return (
    <main className="vallex-admin-page">
      <div className="vallex-admin-shell">
        <header className="vallex-admin-header">
          <div>
            <Link href="/" className="vallex-admin-brand">VALLEX <span>ADMINISTRAÇÃO</span></Link>
            <h1>Central de operação</h1>
            <p>Acompanhe o site, os prestadores e os contatos recebidos pela VALLEX.</p>
            <p className="vallex-admin-restricted-notice">Somente proprietários e pessoas autorizadas da VALLEX acessam esta área.</p>
          </div>
          <div className="vallex-admin-header-actions">
            {isOwner && <Link className="vallex-admin-secondary" href="/admin/acessos">Equipe e permissões</Link>}
            <button type="button" className="vallex-admin-secondary" onClick={() => void loadData()}>Atualizar dados</button>
            <button type="button" className="vallex-admin-back" onClick={() => void handleLogout()} disabled={signingOut}>{signingOut ? "Saindo…" : "Sair"}</button>
            <Link className="vallex-admin-back" href="/">Voltar ao site</Link>
          </div>
        </header>

        {tab === "overview" && <section className="vallex-admin-section vallex-admin-quick-access" aria-label="Atalhos administrativos">
          <div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Atalhos</span><h2>O que precisa de atenção?</h2></div></div>
          <div className="vallex-admin-shortcuts">
            {(isOwner || permissions.support?.view) && <button type="button" onClick={() => setTab("support")}><strong>Fila de suporte</strong><span>{pendingSupport} solicitação(ões) em andamento →</span></button>}
            {(isOwner || permissions.providers?.view) && <button type="button" onClick={() => setTab("providers")}><strong>Acompanhar prestadores</strong><span>Planos, cadastro e situação das vitrines →</span></button>}
            {(isOwner || permissions.traffic?.view) && <Link href="/admin/trafego"><strong>Gestão de tráfego pago</strong><span>Planos, negociações e campanhas →</span></Link>}
            {(isOwner || permissions.traffic?.view) && <Link href="/admin/trafego/resultados"><strong>Painel gráfico de campanhas</strong><span>Ver evolução por cliente, campanha e período →</span></Link>}
            {(isOwner || permissions.sales?.view) && <Link href="/admin/vendas"><strong>Vendas VALLEX</strong><span>Clientes, produtos e acompanhamento comercial →</span></Link>}
            {(isOwner || permissions.finance?.view) && <Link href="/admin/financeiro"><strong>Financeiro VALLEX</strong><span>Saldo Asaas, movimentações e despesas da empresa →</span></Link>}
            {isOwner && <Link href="/admin/acessos"><strong>Equipe e permissões</strong><span>Gerencie os cargos e acessos da equipe VALLEX →</span></Link>}
            <Link href="/contato"><strong>Ver página de contato</strong><span>Confira o formulário e os canais públicos →</span></Link>
            <Link href="/sistema/login"><strong>Acessar área do prestador</strong><span>Conferir a experiência do ServiçoFácil →</span></Link>
          </div>
        </section>}

        <nav className="vallex-admin-tabs" aria-label="Seções administrativas">
          {([ ["overview", "Visão geral", true], ["providers", "Prestadores", isOwner || permissions.providers?.view === true], ["support", "Suporte", isOwner || permissions.support?.view === true] ] as const).filter(([, , allowed]) => allowed).map(([value, label]) => (
            <button key={value} type="button" className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>{label}</button>
          ))}
        </nav>

        {error && <p className="vallex-admin-error" role="alert">{error}</p>}

        {tab === "overview" && <>
          <section className="vallex-admin-metrics" aria-label="Indicadores da plataforma">
            {(isOwner || permissions.providers?.view) && <><article><span>Prestadores cadastrados</span><strong>{providers.length}</strong><small>Contas de negócio na plataforma</small></article><article><span>Vitrines publicadas</span><strong>{publishedProviders}</strong><small>Perfis visíveis no catálogo público</small></article><article><span>Assinaturas pagas ativas</span><strong>{activePaidSubscriptions}</strong><small>Planos pagos com status ativo</small></article>{[...paidPlanCounts.entries()].sort(([codeA], [codeB]) => codeA.localeCompare(codeB)).map(([code, plan]) => <article key={code}><span>{plan.name} ativas</span><strong>{plan.count}</strong><small>Assinaturas pagas deste plano</small></article>)}<article><span>Plano Free ativo</span><strong>{activeFreeSubscriptions}</strong><small>Contas no plano gratuito</small></article></>}
            {(isOwner || permissions.support?.view) && <article><span>Atendimentos abertos</span><strong>{pendingSupport}</strong><small>Contatos ainda em andamento</small></article>}
            {(isOwner || permissions.traffic?.view) && <><article><span>Leads de tráfego</span><strong>{trafficSummary?.leads ?? "—"}</strong><small>{trafficSummary ? `${trafficSummary.pendingLeads} em acompanhamento` : "Aplique a estrutura do módulo para ativar"}</small></article><article><span>Campanhas ativas</span><strong>{trafficSummary?.activeCampaigns ?? "—"}</strong><small>Gestão de tráfego pago</small></article><article><span>Investimento registrado</span><strong>{trafficSummary ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(trafficSummary.spend) : "—"}</strong><small>Gasto de mídia informado pela equipe</small></article></>}
            {(isOwner || permissions.sales?.view) && <><article><span>Contratos VALLEX ativos</span><strong>{salesSummary?.activeContracts ?? "—"}</strong><small>Contratos dentro do período informado</small></article><article><span>Vendas fechadas</span><strong>{salesSummary?.closed ?? "—"}</strong><small>{salesSummary?.customers ?? "—"} cadastros comerciais ativos</small></article><article><span>Aguardando decisão / negociação</span><strong>{salesSummary?.waiting ?? "—"}</strong><small>Propostas e tratativas em aberto</small></article><article><span>Receita mensal contratada</span><strong>{salesSummary ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(salesSummary.monthlyRevenue) : "—"}</strong><small>Contratos ativos registrados em Vendas VALLEX</small></article></>}
          </section>
          {(isOwner || permissions.sales?.view) && <section className="vallex-admin-section"><div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Comercial</span><h2>Contratos por produto</h2><p>Vendas fechadas, clientes aguardando decisão, contratos em vigência e recorrência mensal.</p></div><Link href="/admin/vendas" className="vallex-admin-secondary">Abrir área de vendas</Link></div>{salesSummary ? salesSummary.byProduct.length ? <div className="vallex-admin-table-wrap"><table className="vallex-admin-table"><thead><tr><th>Produto VALLEX</th><th>Fechados</th><th>Em negociação</th><th>Contratos ativos</th><th>Recorrência mensal</th></tr></thead><tbody>{salesSummary.byProduct.map((item) => <tr key={item.product}><td><strong>{item.label}</strong></td><td>{item.closed}</td><td>{item.waiting}</td><td>{item.activeContracts}</td><td>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.monthlyRevenue)}</td></tr>)}</tbody></table></div> : <p className="vallex-admin-empty">Ainda não há vendas registradas.</p> : <p className="vallex-admin-empty">Aplique <code>supabase/vendas_vallex.sql</code> no Supabase de teste para habilitar o painel comercial.</p>}</section>}
          <MetricsDashboard data={metricData} refreshing={metricsRefreshing} onRefresh={() => void refreshMetrics()} />
          <section className="vallex-admin-section vallex-admin-roadmap">
            <span className="vallex-admin-eyebrow">Próximos módulos administrativos</span>
            <div className="vallex-admin-roadmap-grid">
              <article><strong>Conteúdo do site</strong><p>Editar textos, chamadas, serviços da VALLEX e informações institucionais com histórico de alterações.</p><span>Planejado</span></article>
              <article><strong>Qualidade e incidentes</strong><p>Registrar relatos sobre plataforma e prestadores, responsáveis, prazos e histórico de atendimento.</p><span>Planejado</span></article>
              <article><strong>Auditoria de ações</strong><p>Registrar quem consultou ou alterou cada dado administrativo.</p><span>Planejado</span></article>
            </div>
          </section>
        </>}

        {tab === "providers" && <section className="vallex-admin-section">
          <div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Base ServiçoFácil</span><h2>Prestadores da VALLEX</h2><p>Organize os perfis ativos e os removidos da vitrine. A exclusão registra o motivo e preserva a conta e os serviços do prestador.</p></div></div>
          {providerMessage && <p className="traffic-admin-notice" role="status">{providerMessage}</p>}
          <div className="vallex-admin-subtabs" aria-label="Lista de prestadores">
            <button type="button" className={providerListMode === "active" ? "is-active" : ""} onClick={() => setProviderListMode("active")}>Ativos ({activeProviders.length})</button>
            <button type="button" className={providerListMode === "excluded" ? "is-active" : ""} onClick={() => setProviderListMode("excluded")}>Excluídos ({excludedProviders.length})</button>
          </div>
          {providers.length === 0 ? <p className="vallex-admin-empty">Nenhum prestador cadastrado ainda.</p> : providersToShow.length === 0 ? <p className="vallex-admin-empty">{providerListMode === "active" ? "Nenhum prestador ativo." : "Nenhum prestador foi excluído da vitrine."}</p> : <div className="vallex-admin-table-wrap"><table className="vallex-admin-table"><thead><tr><th>Prestador</th><th>Vitrine</th><th>Plano</th><th>Cadastro</th><th>Ações</th></tr></thead><tbody>{providersToShow.map((provider) => {
            const profile = provider.profile;
            const removed = Boolean(profile?.removedAt);
            const canEditProviders = isOwner || permissions.providers?.edit === true;
            const canDeleteProviders = isOwner || permissions.providers?.delete === true;
            return <Fragment key={provider.id}>
              <tr>
                <td><strong>{profile?.displayName ?? provider.name}</strong><small>{provider.businessType ?? "Tipo de serviço não informado"}</small></td>
                <td>
                  <span className={profile?.published ? "vallex-admin-badge is-good" : "vallex-admin-badge"}>{removed ? "Excluída" : profile?.published ? "Publicada" : profile ? "Oculta" : "Sem perfil"}</span>
                  <small>{profile?.serviceArea ?? "Região não informada"}</small>
                  {!removed && profile?.published && <a href={`/prestador/${profile.slug}`} target="_blank" rel="noreferrer">Abrir vitrine ↗</a>}
                  {removed && <div className="vallex-admin-removal-details"><strong>Excluída em {formattedDate(profile!.removedAt!)}</strong><p>Motivo: {profile!.removalReason || "Não informado"}</p></div>}
                </td>
                <td>{provider.subscription?.plan ?? "Sem assinatura"}<small>{provider.subscription?.status ?? "Conta sem plano ativo"}</small></td>
                <td>{formattedDate(provider.createdAt)}</td>
                <td><div className="vallex-admin-provider-actions">
                  {removed ? <>{canEditProviders && <button type="button" className="vallex-admin-secondary" disabled={busyId === provider.id} onClick={() => void restoreProviderVitrine(provider)}>{busyId === provider.id ? "Restaurando…" : "Restaurar ativo"}</button>}</> : <>
                    {profile && canEditProviders && <>
                      <button type="button" className="vallex-admin-secondary" disabled={busyId === provider.id} onClick={() => editingProviderId === provider.id ? setEditingProviderId("") : beginProviderEdit(provider)}>{editingProviderId === provider.id ? "Cancelar edição" : "Editar"}</button>
                      <button type="button" className="vallex-admin-secondary" disabled={busyId === provider.id || (!profile.published && !profile.canRepublish)} onClick={() => void setProviderVisibility(provider, !profile.published)}>{busyId === provider.id ? "Atualizando…" : profile.published ? "Ocultar" : profile.canRepublish ? "Reexibir" : "Aguardando o prestador"}</button>
                    </>}
                    {profile && canDeleteProviders && <button type="button" className="vallex-admin-back" disabled={busyId === provider.id} onClick={() => removingProviderId === provider.id ? setRemovingProviderId("") : beginProviderRemoval(provider)}>{removingProviderId === provider.id ? "Cancelar exclusão" : "Excluir da vitrine"}</button>}
                  </>}</div></td>
              </tr>
              {editingProviderId === provider.id && profile && !removed && <tr><td colSpan={5}><form className="vallex-admin-provider-editor" onSubmit={(event) => { event.preventDefault(); void updateProvider(provider); }}><label>Nome exibido na vitrine<input required minLength={2} maxLength={160} value={providerDraft.displayName} onChange={(event) => setProviderDraft((draft) => ({ ...draft, displayName: event.target.value }))} /></label><label>Região de atendimento<input maxLength={300} value={providerDraft.serviceArea} onChange={(event) => setProviderDraft((draft) => ({ ...draft, serviceArea: event.target.value }))} placeholder="Ex.: Goiânia e região" /></label><div className="vallex-admin-provider-editor-actions"><button type="submit" className="vallex-admin-primary" disabled={busyId === provider.id}>{busyId === provider.id ? "Atualizando…" : "Atualizar vitrine"}</button><button type="button" className="vallex-admin-back" disabled={busyId === provider.id} onClick={() => setEditingProviderId("")}>Cancelar</button></div></form></td></tr>}
              {removingProviderId === provider.id && profile && !removed && canDeleteProviders && <tr><td colSpan={5}><form className="vallex-admin-removal-form" onSubmit={(event) => { event.preventDefault(); void removeProviderVitrine(provider); }}><label>Motivo da exclusão para acompanhamento administrativo<textarea required minLength={3} maxLength={1000} value={removalReason} onChange={(event) => setRemovalReason(event.target.value)} placeholder="Registre por que este perfil está sendo removido da vitrine." /></label><p>O perfil ficará na lista de excluídos e poderá ser restaurado. A conta e os serviços serão preservados.</p><div className="vallex-admin-provider-editor-actions"><button type="submit" className="vallex-admin-back" disabled={busyId === provider.id || removalReason.trim().length < 3}>{busyId === provider.id ? "Excluindo…" : "Confirmar exclusão"}</button><button type="button" className="vallex-admin-secondary" disabled={busyId === provider.id} onClick={() => { setRemovingProviderId(""); setRemovalReason(""); }}>Cancelar</button></div></form></td></tr>}
            </Fragment>;
          })}</tbody></table></div>}
        </section>}

        {tab === "support" && <section className="vallex-admin-section">
          <div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Central de atendimento</span><h2>Solicitações recebidas</h2><p>Identifique de onde veio cada solicitação, a ferramenta relacionada e o plano da conta.</p></div></div>
          <div className="vallex-admin-support-filters">
            <label>Buscar<input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Nome, assunto, ferramenta, telefone ou e-mail" /></label>
            <label>Origem<select value={supportOriginFilter} onChange={(event) => setSupportOriginFilter(event.target.value as typeof supportOriginFilter)}><option value="all">Todas as origens</option><option value="site">Site</option><option value="acesso_prestador">Acesso do prestador</option></select></label>
            <label>Ferramenta<select value={supportToolFilter} onChange={(event) => setSupportToolFilter(event.target.value)}><option value="all">Todas as ferramentas</option>{SUPPORT_TOOLS.map((tool) => <option key={tool} value={tool}>{tool}</option>)}</select></label>
            <label>Plano<select value={supportPlanFilter} onChange={(event) => setSupportPlanFilter(event.target.value)}><option value="all">Todos os planos</option><option value="site">Sem plano registrado</option>{supportPlans.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
          </div>
          {visibleContacts.length === 0 ? <p className="vallex-admin-empty">Nenhuma solicitação corresponde aos filtros.</p> : <div className="vallex-admin-support-list">{visibleContacts.map((contact) => <article key={contact.id} className="vallex-admin-support-card">
            <div className="vallex-admin-support-top"><div><span className="vallex-admin-eyebrow">{contact.servico}</span><h3>{contact.nome}</h3><small>Recebido em {formattedDate(contact.criado_em)}</small></div><label className="vallex-admin-status">Etapa<select disabled={busyId === contact.id || (!isOwner && permissions.support?.edit !== true)} value={contact.status} onChange={(event) => void updateContactStatus(contact, event.target.value as ContactStatus)}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label></div>
            <div className="vallex-admin-support-metadata"><span className={contact.origem === "acesso_prestador" ? "is-provider" : "is-site"}>Origem: {supportOriginLabel(contact.origem)}</span><span>Ferramenta: {contact.ferramenta ?? "Solicitação do site"}</span><span>Plano: {contact.plano_nome ?? "Não informado"}</span></div>
            <p className="vallex-admin-description">{contact.descricao}</p>
            {contact.organization_id && <p className="vallex-admin-muted">Conta de prestador vinculada à solicitação.</p>}
            <div className="vallex-admin-contact-links"><a href={`tel:${contact.telefone.replace(/[^+\d]/g, "")}`}>{contact.telefone}</a>{contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{contact.data_preferida && <span>Preferência: {formattedDate(contact.data_preferida)}{contact.horario_preferido ? ` · ${contact.horario_preferido}` : ""}</span>}</div>
            {contact.sugestao_futura && <p className="vallex-admin-suggestion"><strong>Sugestão:</strong> {contact.sugestao_futura}</p>}
          </article>)}</div>}
        </section>}

        <footer className="vallex-admin-footer">Acesso restrito à administração e à equipe autorizada · Dados carregados com sessão autenticada.</footer>
      </div>
    </main>
  );
}
