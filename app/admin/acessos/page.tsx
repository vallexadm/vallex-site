"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Permissions = Record<string, Record<string, boolean>>;
type Member = { id: string; user_id: string | null; display_name: string; email: string | null; permissions: Permissions; is_active: boolean };
type Draft = Omit<Member, "user_id">;
const permissionGroups = [
  { module: "traffic", label: "Tráfego pago", actions: [["view", "Consultar dados e indicadores"], ["manage_plans", "Editar os planos da vitrine"], ["manage_leads", "Alterar negociações e registrar contatos"], ["manage_campaigns", "Criar campanhas e editar indicadores"]] },
  { module: "support", label: "Suporte", actions: [["view", "Consultar solicitações"], ["edit", "Atualizar solicitações"]] },
  { module: "providers", label: "Prestadores", actions: [["view", "Consultar prestadores e vitrines"], ["edit", "Editar dados e controlar a visibilidade da vitrine"], ["delete", "Excluir perfil da vitrine (preserva conta e serviços)"]] },
  { module: "finance", label: "Financeiro", actions: [["view", "Consultar dados financeiros"], ["edit", "Editar dados financeiros"], ["delete", "Excluir dados financeiros"]] },
] as const;

function newPermissions(): Permissions {
  return Object.fromEntries(permissionGroups.map(({ module, actions }) => [module, Object.fromEntries(actions.map(([key]) => [key, false]))]));
}
function draftFrom(member: Member): Draft { return { id: member.id, display_name: member.display_name, email: member.email, permissions: { ...newPermissions(), ...member.permissions }, is_active: member.is_active }; }

export default function AdminAcessosPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
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
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Falha ao carregar os acessos."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  function edit(id: string, update: (draft: Draft) => Draft) {
    setDrafts((current) => ({ ...current, [id]: update(current[id]) }));
  }
  function addMember() {
    const id = `new-${Date.now()}`;
    const draft: Draft = { id, display_name: "", email: null, permissions: newPermissions(), is_active: false };
    setDrafts((current) => ({ ...current, [id]: draft }));
    setEditing((current) => ({ ...current, [id]: true }));
    setMembers((current) => [...current, { ...draft, user_id: null }]);
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
    <header className="vallex-admin-header"><div><Link href="/admin" className="vallex-admin-brand">VALLEX <span>ADMINISTRAÇÃO</span></Link><h1>Equipe e permissões</h1><p>Cadastre até duas pessoas e defina o que cada uma pode consultar ou alterar.</p></div><div className="vallex-admin-header-actions"><Link href="/admin" className="vallex-admin-back">Voltar ao admin</Link></div></header>
    <div className="vallex-admin-section">
      <p className="vallex-admin-muted">Os cadastros iniciais são espaços editáveis. Informe o e-mail que a pessoa usará para criar uma conta no sistema; depois, volte aqui para ativar o acesso. Alexandre começa com permissões de tráfego. O Financeiro permanece desligado até você liberar. As permissões de prestadores controlam a edição, a visibilidade e a remoção de perfis públicos.</p>
      {error && <p className="vallex-admin-error" role="alert">{error}</p>}{message && <p className="traffic-admin-notice" role="status">{message}</p>}
      {loading ? <p className="vallex-admin-empty">Carregando cadastros…</p> : <div className="space-y-5">{members.map((member) => {
        const draft = drafts[member.id] ?? draftFrom(member);
        const canEdit = editing[member.id] === true;
        return <article key={member.id} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-900">{draft.display_name || "Novo acesso"}</h2><p className="text-sm text-slate-600">{member.user_id ? "Conta vinculada ao Supabase Auth" : "Pendente: conta ainda não vinculada"}</p></div><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={draft.is_active} disabled={!canEdit || !member.user_id} onChange={(event) => edit(member.id, (item) => ({ ...item, is_active: event.target.checked }))} /> Ativar acesso</label></div>
          <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Nome<input disabled={!canEdit} className="rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" value={draft.display_name} onChange={(event) => edit(member.id, (item) => ({ ...item, display_name: event.target.value }))} placeholder="Nome da pessoa" /></label><label className="grid gap-1 text-sm font-medium">E-mail da conta<input disabled={!canEdit} className="rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" type="email" value={draft.email ?? ""} onChange={(event) => edit(member.id, (item) => ({ ...item, email: event.target.value || null, is_active: false }))} placeholder="pessoa@exemplo.com" /></label></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">{permissionGroups.map(({ module, label, actions }) => <section key={module} className="rounded-xl bg-slate-50 p-4"><h3 className="mb-2 font-semibold text-slate-900">{label}</h3>{actions.map(([action, text]) => <label key={action} className="mb-2 flex items-start gap-2 text-sm text-slate-700"><input disabled={!canEdit} type="checkbox" className="mt-1 accent-violet-700" checked={draft.permissions[module]?.[action] === true} onChange={(event) => edit(member.id, (item) => ({ ...item, permissions: { ...item.permissions, [module]: { ...item.permissions[module], [action]: event.target.checked } } }))} /><span>{text}</span></label>)}</section>)}</div>
          <div className="mt-5 flex flex-wrap gap-3">{!canEdit && !member.id.startsWith("new-") && <button className="vallex-admin-secondary" type="button" onClick={() => setEditing((current) => ({ ...current, [member.id]: true }))}>Editar</button>}<button className="vallex-admin-primary" type="button" disabled={!canEdit || saving === member.id} onClick={() => void save(member)}>{saving === member.id ? "Salvando…" : "Salvar alterações"}</button><button className="vallex-admin-back" type="button" disabled={saving === member.id} onClick={() => void remove(member)}>Excluir acesso</button></div>
          <p className="mt-3 text-xs text-slate-500">Financeiro: permissão configurável para uso futuro; este painel ainda não oferece operações financeiras delegadas.</p>
        </article>;
      })}</div>}
      {!loading && members.length < 2 && <button type="button" className="vallex-admin-secondary mt-5" onClick={addMember}>+ Adicionar pessoa ({members.length}/2)</button>}
    </div>
  </div></main>;
}
