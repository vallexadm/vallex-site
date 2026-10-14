"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

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
  subscription: null | { status: string; currentPeriodEnd: string | null; plan: string };
};

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
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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
      const [contactsResponse, providersResponse] = await Promise.all([
        fetch("/api/contatos", { headers, cache: "no-store" }),
        fetch("/api/admin/prestadores", { headers, cache: "no-store" }),
      ]);
      if ([401, 403].includes(contactsResponse.status) || [401, 403].includes(providersResponse.status)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      const [contactsResult, providersResult] = await Promise.all([
        contactsResponse.json(),
        providersResponse.json(),
      ]);
      if (!contactsResponse.ok || !contactsResult.ok) {
        throw new Error(contactsResult.message ?? "Não foi possível carregar o suporte.");
      }
      if (!providersResponse.ok || !providersResult.ok) {
        throw new Error(providersResult.message ?? "Não foi possível carregar os prestadores.");
      }
      setContacts(contactsResult.contatos ?? []);
      setProviders(providersResult.providers ?? []);
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
  const activeSubscriptions = providers.filter((provider) => ["active", "trialing"].includes(provider.subscription?.status ?? "")).length;

  if (loading) return <main className="vallex-admin-page"><div className="vallex-admin-shell"><p className="vallex-admin-muted">Carregando administração da VALLEX…</p></div></main>;

  if (accessDenied) return (
    <main className="vallex-admin-page">
      <div className="vallex-admin-shell vallex-admin-access">
        <span className="vallex-admin-eyebrow">Área restrita</span>
        <h1>Administração VALLEX</h1>
        <p>Entre com a conta administrativa da plataforma. O acesso de proprietário de um prestador não libera este painel.</p>
        <Link className="vallex-admin-primary" href="/sistema/login?next=%2Fadmin">Ir para o acesso</Link>
        <button className="vallex-admin-back" type="button" onClick={() => void handleLogout()} disabled={signingOut}>
          {signingOut ? "Saindo…" : "Sair da conta"}
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
          </div>
          <div className="vallex-admin-header-actions">
            <button type="button" className="vallex-admin-secondary" onClick={() => void loadData()}>Atualizar dados</button>
            <button type="button" className="vallex-admin-back" onClick={() => void handleLogout()} disabled={signingOut}>{signingOut ? "Saindo…" : "Sair"}</button>
            <Link className="vallex-admin-back" href="/">Voltar ao site</Link>
          </div>
        </header>

        <nav className="vallex-admin-tabs" aria-label="Seções administrativas">
          {([ ["overview", "Visão geral"], ["providers", "Prestadores"], ["support", "Suporte"] ] as const).map(([value, label]) => (
            <button key={value} type="button" className={tab === value ? "is-active" : ""} onClick={() => setTab(value)}>{label}</button>
          ))}
        </nav>

        {error && <p className="vallex-admin-error" role="alert">{error}</p>}

        {tab === "overview" && <>
          <section className="vallex-admin-metrics" aria-label="Indicadores da plataforma">
            <article><span>Prestadores cadastrados</span><strong>{providers.length}</strong><small>Contas de negócio na plataforma</small></article>
            <article><span>Vitrines publicadas</span><strong>{publishedProviders}</strong><small>Perfis visíveis no catálogo público</small></article>
            <article><span>Assinaturas ativas</span><strong>{activeSubscriptions}</strong><small>Planos ativos ou em período de teste</small></article>
            <article><span>Atendimentos abertos</span><strong>{pendingSupport}</strong><small>Contatos ainda em andamento</small></article>
          </section>
          <section className="vallex-admin-section">
            <div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Atalhos</span><h2>O que precisa de atenção?</h2></div></div>
            <div className="vallex-admin-shortcuts">
              <button type="button" onClick={() => setTab("support")}><strong>Fila de suporte</strong><span>{pendingSupport} solicitação(ões) em andamento →</span></button>
              <button type="button" onClick={() => setTab("providers")}><strong>Acompanhar prestadores</strong><span>Planos, cadastro e situação das vitrines →</span></button>
              <Link href="/contato"><strong>Ver página de contato</strong><span>Confira o formulário e os canais públicos →</span></Link>
              <Link href="/sistema/login"><strong>Acessar área do prestador</strong><span>Conferir a experiência do ServiçoFácil →</span></Link>
            </div>
          </section>
          <section className="vallex-admin-section vallex-admin-roadmap">
            <span className="vallex-admin-eyebrow">Próximos módulos administrativos</span>
            <div className="vallex-admin-roadmap-grid">
              <article><strong>Conteúdo do site</strong><p>Editar textos, chamadas, serviços da VALLEX e informações institucionais com histórico de alterações.</p><span>Planejado</span></article>
              <article><strong>Qualidade e incidentes</strong><p>Registrar relatos sobre plataforma e prestadores, responsáveis, prazos e histórico de atendimento.</p><span>Planejado</span></article>
              <article><strong>Auditoria e permissões</strong><p>Separar suporte, operação e administração geral, guardando quem consultou ou alterou cada dado.</p><span>Planejado</span></article>
            </div>
          </section>
        </>}

        {tab === "providers" && <section className="vallex-admin-section">
          <div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Base ServiçoFácil</span><h2>Prestadores da VALLEX</h2><p>Visão operacional de contas e vitrines. Esta primeira versão não altera planos, publicação ou acesso.</p></div></div>
          {providers.length === 0 ? <p className="vallex-admin-empty">Nenhum prestador cadastrado ainda.</p> : <div className="vallex-admin-table-wrap"><table className="vallex-admin-table"><thead><tr><th>Prestador</th><th>Vitrine</th><th>Plano</th><th>Cadastro</th></tr></thead><tbody>{providers.map((provider) => <tr key={provider.id}><td><strong>{provider.profile?.displayName ?? provider.name}</strong><small>{provider.businessType ?? "Tipo de serviço não informado"}</small></td><td><span className={provider.profile?.published ? "vallex-admin-badge is-good" : "vallex-admin-badge"}>{provider.profile?.published ? "Publicada" : provider.profile ? "Não publicada" : "Sem perfil"}</span><small>{provider.profile?.serviceArea ?? "Região não informada"}</small>{provider.profile?.published && <a href={`/prestador/${provider.profile.slug}`} target="_blank" rel="noreferrer">Abrir vitrine ↗</a>}</td><td>{provider.subscription?.plan ?? "Sem assinatura"}<small>{provider.subscription?.status ?? "Conta sem plano ativo"}</small></td><td>{formattedDate(provider.createdAt)}</td></tr>)}</tbody></table></div>}
        </section>}

        {tab === "support" && <section className="vallex-admin-section">
          <div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Central de atendimento</span><h2>Solicitações recebidas</h2><p>Atualize a etapa de acompanhamento e contate a pessoa pelo canal informado.</p></div><label className="vallex-admin-search"><span>Buscar</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Nome, serviço, telefone ou e-mail" /></label></div>
          {visibleContacts.length === 0 ? <p className="vallex-admin-empty">Nenhuma solicitação corresponde à busca.</p> : <div className="vallex-admin-support-list">{visibleContacts.map((contact) => <article key={contact.id} className="vallex-admin-support-card"><div className="vallex-admin-support-top"><div><span className="vallex-admin-eyebrow">{contact.servico}</span><h3>{contact.nome}</h3><small>Recebido em {formattedDate(contact.criado_em)}</small></div><label className="vallex-admin-status">Etapa<select disabled={busyId === contact.id} value={contact.status} onChange={(event) => void updateContactStatus(contact, event.target.value as ContactStatus)}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label></div><p className="vallex-admin-description">{contact.descricao}</p><div className="vallex-admin-contact-links"><a href={`tel:${contact.telefone.replace(/[^+\d]/g, "")}`}>{contact.telefone}</a>{contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{contact.data_preferida && <span>Preferência: {formattedDate(contact.data_preferida)}{contact.horario_preferido ? ` · ${contact.horario_preferido}` : ""}</span>}</div>{contact.sugestao_futura && <p className="vallex-admin-suggestion"><strong>Sugestão:</strong> {contact.sugestao_futura}</p>}</article>)}</div>}
        </section>}

        <footer className="vallex-admin-footer">Acesso restrito à administração da plataforma · Dados carregados com sessão autenticada.</footer>
      </div>
    </main>
  );
}
