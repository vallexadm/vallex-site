"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase/client";

type Permissions = Record<string, Record<string, boolean>>;
type Member = { id: string; user_id: string | null; display_name: string; role_title: string; email: string | null; permissions: Permissions; is_active: boolean };
type Draft = Omit<Member, "user_id">;
const permissionGroups = [
  { module: "traffic", label: "Tráfego pago", actions: [["view", "Consultar dados e indicadores"], ["manage_plans", "Editar os planos da vitrine"], ["manage_leads", "Alterar negociações e registrar contatos"], ["manage_campaigns", "Criar campanhas e editar indicadores"]] },
  { module: "support", label: "Suporte", actions: [["view", "Consultar solicitações"], ["edit", "Atualizar solicitações"]] },
  { module: "providers", label: "Prestadores", actions: [["view", "Consultar prestadores e vitrines"], ["edit", "Editar dados e controlar a visibilidade da vitrine"], ["delete", "Excluir perfil da vitrine (preserva conta e serviços)"]] },
  { module: "finance", label: "Financeiro VALLEX", actions: [["view", "Consultar saldo Asaas, despesas e contratos comerciais"], ["edit", "Registrar e atualizar movimentações da VALLEX"], ["delete", "Excluir lançamentos financeiros manuais"]] },
  { module: "sales", label: "Vendas VALLEX", actions: [["view", "Consultar clientes e oportunidades"], ["create", "Cadastrar clientes e oportunidades"], ["edit", "Editar cadastros e negociações"], ["delete", "Arquivar cadastros"]] },
] as const;

function newPermissions(): Permissions {
  return Object.fromEntries(permissionGroups.map(({ module, actions }) => [module, Object.fromEntries(actions.map(([key]) => [key, false]))]));
}
function draftFrom(member: Member): Draft { return { id: member.id, display_name: member.display_name, role_title: member.role_title || "Cargo a definir", email: member.email, permissions: { ...newPermissions(), ...member.permissions }, is_active: member.is_active }; }

export default function AdminAcessosPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copiedLinkId, setCopiedLinkId] = useState("");

  const load = useCallback(async (): Promise<Member[] | null> => {
    setLoading(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Entre com sua conta administradora da VALLEX.");
      const response = await fetch("/api/admin/acessos", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível carregar os acessos.");
      const next = (result.members ?? []) as Member[];
      setMembers(next);
      setDrafts(Object.fromEntries(next.map((item) => [item.id, draftFrom(item)])));
      setEditing({});
      setExpandedMembers({});
      return next;
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Falha ao carregar os acessos."); return null; }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  function edit(id: string, update: (draft: Draft) => Draft) {
    setDrafts((current) => ({ ...current, [id]: update(current[id]) }));
  }
  function addMember() {
    const id = `new-${Date.now()}`;
    const draft: Draft = { id, display_name: "", role_title: "", email: null, permissions: newPermissions(), is_active: false };
    setDrafts((current) => ({ ...current, [id]: draft }));
    setEditing((current) => ({ ...current, [id]: true }));
    setExpandedMembers((current) => ({ ...current, [id]: true }));
    setMembers((current) => [{ ...draft, user_id: null }, ...current]);
  }
  async function save(member: Member) {
    const draft = drafts[member.id];
    setSaving(member.id); setError(""); setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const isNew = member.id.startsWith("new-");
      const response = await fetch("/api/admin/acessos", { method: isNew ? "POST" : "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, is_active: draft.is_active }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível salvar.");
      setMessage(result.pending ? "Cadastro salvo. Assim que essa pessoa criar uma conta com esse e-mail, edite e ative o acesso." : "Acesso salvo.");
      await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Falha ao salvar."); }
    finally { setSaving(""); }
  }
  async function verifyMember(member: Member) {
    setMessage("");
    const refreshedMembers = await load();
    if (!refreshedMembers) return;
    const refreshedMember = refreshedMembers.find((item) => item.id === member.id);
    setMessage(refreshedMember?.user_id
      ? "Conta vinculada. Clique em Editar dados, marque Ativar acesso e salve as alterações."
      : `Ainda não encontramos uma conta para ${member.email || "o e-mail cadastrado"}. A pessoa precisa criar a conta usando esse mesmo e-mail.`);
  }
  async function setMemberActive(member: Member, isActive: boolean) {
    const draft = drafts[member.id] ?? draftFrom(member);
    setSaving(member.id); setError(""); setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/admin/acessos", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, is_active: isActive }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível atualizar o acesso.");
      setMessage(isActive ? "Acesso do funcionário reativado." : "Acesso do funcionário inativado.");
      await load();
    } catch (accessError) {
      setError(accessError instanceof Error ? accessError.message : "Falha ao atualizar o acesso.");
    } finally {
      setSaving("");
    }
  }
  async function copyTeamSignupLink(member: Member) {
    if (!member.email) {
      setError("Cadastre o e-mail da pessoa antes de copiar o link.");
      return;
    }
    const link = `${window.location.origin}/sistema/equipe/cadastro?email=${encodeURIComponent(member.email.trim().toLowerCase())}`;
    try {
      await navigator.clipboard.writeText(link);
      setError("");
      setCopiedLinkId(member.id);
      window.setTimeout(() => setCopiedLinkId((current) => current === member.id ? "" : current), 4000);
    } catch {
      setError("Não foi possível copiar automaticamente. Abra o cadastro da equipe e copie o endereço do navegador.");
    }
  }
  async function remove(member: Member) {
    if (member.id.startsWith("new-")) { setMembers((items) => items.filter((item) => item.id !== member.id)); setDrafts((items) => { const copy = { ...items }; delete copy[member.id]; return copy; }); return; }
    setSaving(member.id); setError(""); setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/admin/acessos", { method: "DELETE", headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: member.id }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível excluir.");
      setMessage("Acesso removido."); await load();
    } catch (removeError) { setError(removeError instanceof Error ? removeError.message : "Falha ao excluir."); }
    finally { setSaving(""); }
  }

  return <main className="vallex-admin-page"><div className="vallex-admin-shell">
    {copiedLinkId && typeof document !== "undefined" && createPortal(<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-900 shadow-lg" style={{ position: "fixed", top: 16, left: "50%", zIndex: 10000, transform: "translateX(-50%)" }} role="status" aria-live="polite">✓ Link de cadastro da equipe copiado</div>, document.body)}
    <header className="vallex-admin-header"><div><Link href="/admin" className="vallex-admin-brand">VALLEX <span>ADMINISTRAÇÃO</span></Link><h1>Equipe e permissões</h1><p>Cadastre sócios e funcionários, informe o cargo e escolha o que cada pessoa pode consultar ou alterar.</p></div><div className="vallex-admin-header-actions"><button type="button" className="vallex-admin-primary" onClick={addMember}>+ Adicionar pessoa</button><Link href="/admin" className="vallex-admin-back">Voltar ao admin</Link></div></header>
    <div className="vallex-admin-section">
      <p className="vallex-admin-muted">Esta área é para sócios e funcionários da VALLEX, não para prestadores. Cadastre aqui o nome, o cargo e o e-mail que a pessoa usará para criar a conta no sistema; ela deve se cadastrar com esse mesmo e-mail. A VALLEX confere o vínculo automaticamente ao abrir a página. Se a conta ainda não existir, use Verificar conta depois do cadastro. Quando aparecer como vinculada, clique em Editar dados, marque Ativar acesso e salve. O cargo identifica a função; as permissões por área continuam sendo definidas separadamente abaixo.</p>
      {error && <p className="vallex-admin-error" role="alert">{error}</p>}{message && <p className="traffic-admin-notice" role="status">{message}</p>}
      {loading ? <p className="vallex-admin-empty">Carregando cadastros…</p> : <div className="space-y-5">{members.map((member) => {
        const draft = drafts[member.id] ?? draftFrom(member);
        const canEdit = editing[member.id] === true;
        const isExpanded = expandedMembers[member.id] === true;
        return <article key={member.id} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-semibold text-slate-900">{draft.display_name || "Novo acesso"}</h2><p className="text-sm text-slate-600">{draft.role_title || "Cargo não informado"} · {member.user_id ? "Conta vinculada" : "Pendente: conta ainda não vinculada"} · {draft.is_active ? "Acesso ativo" : "Acesso inativo"}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              {!canEdit && !member.id.startsWith("new-") && <button className="vallex-admin-secondary" type="button" onClick={() => { setEditing((current) => ({ ...current, [member.id]: true })); setExpandedMembers((current) => ({ ...current, [member.id]: true })); }}>Editar dados</button>}
              <button className="vallex-admin-secondary" type="button" aria-expanded={isExpanded} aria-controls={`team-member-details-${member.id}`} onClick={() => setExpandedMembers((current) => ({ ...current, [member.id]: !current[member.id] }))}>{isExpanded ? "Recolher cadastro" : "Expandir cadastro"}</button>
            </div>
          </div>
          {isExpanded && <div id={`team-member-details-${member.id}`} className="mt-4 border-t border-slate-200 pt-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div>{!member.user_id && !member.id.startsWith("new-") && member.email && <button className="vallex-admin-secondary" type="button" disabled={loading} onClick={() => void verifyMember(member)}>{loading ? "Verificando…" : "Verificar conta"}</button>}</div><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={draft.is_active} disabled={!canEdit || !member.user_id} onChange={(event) => edit(member.id, (item) => ({ ...item, is_active: event.target.checked }))} /> Ativar acesso</label></div>
            <div className="grid gap-4 md:grid-cols-3"><label className="grid gap-1 text-sm font-medium">Nome<input disabled={!canEdit} className="rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" value={draft.display_name} onChange={(event) => edit(member.id, (item) => ({ ...item, display_name: event.target.value }))} placeholder="Nome da pessoa" /></label><label className="grid gap-1 text-sm font-medium">Cargo na VALLEX<input disabled={!canEdit} className="rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" value={draft.role_title} onChange={(event) => edit(member.id, (item) => ({ ...item, role_title: event.target.value }))} placeholder="Ex.: Sócio, Suporte, Estagiário" /></label><label className="grid gap-1 text-sm font-medium">E-mail da conta<input disabled={!canEdit} className="rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" type="email" value={draft.email ?? ""} onChange={(event) => edit(member.id, (item) => ({ ...item, email: event.target.value || null, is_active: false }))} placeholder="pessoa@exemplo.com" /></label></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">{permissionGroups.map(({ module, label, actions }) => <section key={module} className="rounded-xl bg-slate-50 p-4"><h3 className="mb-2 font-semibold text-slate-900">{label}</h3>{actions.map(([action, text]) => <label key={action} className="mb-2 flex items-start gap-2 text-sm text-slate-700"><input disabled={!canEdit} type="checkbox" className="mt-1 accent-violet-700" checked={draft.permissions[module]?.[action] === true} onChange={(event) => edit(member.id, (item) => ({ ...item, permissions: { ...item.permissions, [module]: { ...item.permissions[module], [action]: event.target.checked } } }))} /><span>{text}</span></label>)}</section>)}</div>
            <div className="mt-5 flex flex-wrap items-start gap-3">{!member.id.startsWith("new-") && <button className="vallex-admin-secondary" type="button" disabled={!member.email} onClick={() => void copyTeamSignupLink(member)}>Copiar link de cadastro da equipe</button>}{!canEdit && member.user_id && <button className={draft.is_active ? "vallex-admin-back" : "vallex-admin-secondary"} type="button" disabled={saving === member.id} onClick={() => void setMemberActive(member, !draft.is_active)}>{saving === member.id ? "Atualizando…" : draft.is_active ? "Inativar acesso" : "Reativar acesso"}</button>}<button className="vallex-admin-primary" type="button" disabled={!canEdit || saving === member.id} onClick={() => void save(member)}>{saving === member.id ? "Salvando…" : "Salvar alterações"}</button><button className="vallex-admin-back" type="button" disabled={saving === member.id} onClick={() => void remove(member)}>Excluir acesso</button></div>
            <p className="mt-3 text-xs text-slate-500">O Financeiro VALLEX é separado do financeiro de cada prestador; as permissões desta área controlam somente os dados da empresa.</p>
          </div>}
        </article>;
      })}</div>}
    </div>
  </div></main>;
}
