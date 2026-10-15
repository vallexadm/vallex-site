"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
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
};
type Provider = {
  id: string;
  name: string;
  businessType: string | null;
  createdAt: string;
  profile: null | { slug: string; displayName: string; published: boolean; serviceArea: string | null; updatedAt: string };
  subscription: null | { status: string; currentPeriodEnd: string | null; plan: string; planCode: string };
};
type TrafficSummary = { leads: number; pendingLeads: number; activeCampaigns: number; spend: number };
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
  const [trafficSummary, setTrafficSummary] = useState<TrafficSummary | null>(null);
  const [metricData, setMetricData] = useState<MetricData | null>(null);
  const [metricsRefreshing, setMetricsRefreshing] = useState(false);
  const [permissions, setPermissions] = useState<AdminPermissions>({});
  const [isOwner, setIsOwner] = useState(false);
  const [filter, setFilter] = useState("");
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
    void refreshMetrics();
    const interval = window.setInterval(() => void refreshMetrics(), 60_000);
    return () => window.clearInterval(interval);
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
      const [contactsResponse, providersResponse, trafficResponse] = await Promise.all([
        accessResult.isAdmin || grants.support?.view ? fetch("/api/contatos", { headers, cache: "no-store" }) : Promise.resolve(null),
        accessResult.isAdmin || grants.providers?.view ? fetch("/api/admin/prestadores", { headers, cache: "no-store" }) : Promise.resolve(null),
        accessResult.isAdmin || grants.traffic?.view ? fetch("/api/admin/trafego/resumo", { headers, cache: "no-store" }) : Promise.resolve(null),
      ]);
      const [contactsResult, providersResult, trafficResult] = await Promise.all([
        contactsResponse ? contactsResponse.json() : null,
        providersResponse ? providersResponse.json() : null,
        trafficResponse?.ok ? trafficResponse.json() : null,
      ]);
      if (contactsResponse && (!contactsResponse.ok || !contactsResult?.ok)) throw new Error(contactsResult?.message ?? "Não foi possível carregar o suporte.");
      if (providersResponse && (!providersResponse.ok || !providersResult?.ok)) throw new Error(providersResult?.message ?? "Não foi possível carregar os prestadores.");
      setContacts(contactsResult?.contatos ?? []);
      setProviders(providersResult?.providers ?? []);
      setTrafficSummary(trafficResult?.ok ? trafficResult : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar os dados administrativos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

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
      if (!normalized) return true;
      return [contact.nome, contact.servico, contact.telefone, contact.email ?? ""]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(normalized));
    });
  }, [contacts, filter]);

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
        <span className="vallex-admin-eyebrow">Área restrita</span>
        <h1>Administração VALLEX</h1>
        <p>Somente proprietários e pessoas autorizadas da VALLEX acessam esta área. Entre com uma conta autorizada; a conta de proprietário de um prestador não libera este painel.</p>
        <Link className="vallex-admin-primary" href="/sistema/login?next=%2Fadmin">Ir para o acesso</Link>
        <button className="vallex-admin-back" type="button" onClick={() => void handleLogout()} disabled={signingOut}>
          {signingOut ? "Saindo…" : "Sair da conta atual"}
        </button>
        <Link className="vallex-admin-back" href="/">Voltar ao site</Link>
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
          </section>
          <MetricsDashboard data={metricData} refreshing={metricsRefreshing} onRefresh={() => void refreshMetrics()} />
          <section className="vallex-admin-section">
            <div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Atalhos</span><h2>O que precisa de atenção?</h2></div></div>
            <div className="vallex-admin-shortcuts">
              {(isOwner || permissions.support?.view) && <button type="button" onClick={() => setTab("support")}><strong>Fila de suporte</strong><span>{pendingSupport} solicitação(ões) em andamento →</span></button>}
              {(isOwner || permissions.providers?.view) && <button type="button" onClick={() => setTab("providers")}><strong>Acompanhar prestadores</strong><span>Planos, cadastro e situação das vitrines →</span></button>}
              {(isOwner || permissions.traffic?.view) && <Link href="/admin/trafego"><strong>Gestão de tráfego pago</strong><span>Planos, negociações e indicadores de campanhas →</span></Link>}
              {isOwner && <Link href="/admin/acessos"><strong>Equipe e permissões</strong><span>Gerencie Alexandre e até mais uma pessoa →</span></Link>}
              <Link href="/contato"><strong>Ver página de contato</strong><span>Confira o formulário e os canais públicos →</span></Link>
              <Link href="/sistema/login"><strong>Acessar área do prestador</strong><span>Conferir a experiência do ServiçoFácil →</span></Link>
            </div>
          </section>
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
          <div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Base ServiçoFácil</span><h2>Prestadores da VALLEX</h2><p>Visão operacional de contas e vitrines. Esta primeira versão não altera planos, publicação ou acesso.</p></div></div>
          {providers.length === 0 ? <p className="vallex-admin-empty">Nenhum prestador cadastrado ainda.</p> : <div className="vallex-admin-table-wrap"><table className="vallex-admin-table"><thead><tr><th>Prestador</th><th>Vitrine</th><th>Plano</th><th>Cadastro</th></tr></thead><tbody>{providers.map((provider) => <tr key={provider.id}><td><strong>{provider.profile?.displayName ?? provider.name}</strong><small>{provider.businessType ?? "Tipo de serviço não informado"}</small></td><td><span className={provider.profile?.published ? "vallex-admin-badge is-good" : "vallex-admin-badge"}>{provider.profile?.published ? "Publicada" : provider.profile ? "Não publicada" : "Sem perfil"}</span><small>{provider.profile?.serviceArea ?? "Região não informada"}</small>{provider.profile?.published && <a href={`/prestador/${provider.profile.slug}`} target="_blank" rel="noreferrer">Abrir vitrine ↗</a>}</td><td>{provider.subscription?.plan ?? "Sem assinatura"}<small>{provider.subscription?.status ?? "Conta sem plano ativo"}</small></td><td>{formattedDate(provider.createdAt)}</td></tr>)}</tbody></table></div>}
        </section>}

        {tab === "support" && <section className="vallex-admin-section">
          <div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Central de atendimento</span><h2>Solicitações recebidas</h2><p>Atualize a etapa de acompanhamento e contate a pessoa pelo canal informado.</p></div><label className="vallex-admin-search"><span>Buscar</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Nome, serviço, telefone ou e-mail" /></label></div>
          {visibleContacts.length === 0 ? <p className="vallex-admin-empty">Nenhuma solicitação corresponde à busca.</p> : <div className="vallex-admin-support-list">{visibleContacts.map((contact) => <article key={contact.id} className="vallex-admin-support-card"><div className="vallex-admin-support-top"><div><span className="vallex-admin-eyebrow">{contact.servico}</span><h3>{contact.nome}</h3><small>Recebido em {formattedDate(contact.criado_em)}</small></div><label className="vallex-admin-status">Etapa<select disabled={busyId === contact.id || (!isOwner && permissions.support?.edit !== true)} value={contact.status} onChange={(event) => void updateContactStatus(contact, event.target.value as ContactStatus)}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label></div><p className="vallex-admin-description">{contact.descricao}</p><div className="vallex-admin-contact-links"><a href={`tel:${contact.telefone.replace(/[^+\d]/g, "")}`}>{contact.telefone}</a>{contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{contact.data_preferida && <span>Preferência: {formattedDate(contact.data_preferida)}{contact.horario_preferido ? ` · ${contact.horario_preferido}` : ""}</span>}</div>{contact.sugestao_futura && <p className="vallex-admin-suggestion"><strong>Sugestão:</strong> {contact.sugestao_futura}</p>}</article>)}</div>}
        </section>}

        <footer className="vallex-admin-footer">Acesso restrito à administração e à equipe autorizada · Dados carregados com sessão autenticada.</footer>
      </div>
    </main>
  );
}
