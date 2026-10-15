"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SystemBrand from "@/components/SystemBrand";
import { supabase } from "@/lib/supabase/client";
import { normalizeMemberPermissions, type MemberPermissions } from "@/lib/team-permissions";

type Organization = { id: string; name: string; business_type: string | null };
type ApiResult = { ok: boolean; message?: string; role?: string; organization?: Organization };
type TeamMember = { user_id: string; name: string | null; email: string | null; role: string; permissions: MemberPermissions };

const permissionModules: { key: keyof MemberPermissions; title: string; description: string; actions: { key: string; label: string }[] }[] = [
  { key: "customers", title: "Clientes", description: "Acesso aos dados de contato dos clientes.", actions: [{ key: "view", label: "Consultar clientes" }, { key: "manage", label: "Cadastrar, alterar e excluir" }] },
  { key: "quotes", title: "Orçamentos", description: "Propostas da organização; aprovação e exclusão continuam exclusivas do proprietário.", actions: [{ key: "view", label: "Consultar orçamentos" }, { key: "create", label: "Criar orçamentos" }, { key: "edit", label: "Editar propostas pendentes" }] },
  { key: "agenda", title: "Agenda", description: "Atendimentos atribuídos ou gerenciamento da agenda da equipe.", actions: [{ key: "view", label: "Consultar atendimentos" }, { key: "updateAssigned", label: "Atualizar os próprios atendimentos" }, { key: "manage", label: "Criar e atribuir atendimentos" }] },
  { key: "services", title: "Serviços", description: "Catálogo e publicação de ofertas na Vitrine.", actions: [{ key: "view", label: "Consultar catálogo" }, { key: "manage", label: "Cadastrar, alterar e publicar serviços" }] },
  { key: "finance", title: "Financeiro", description: "Valores, recebimentos e despesas do negócio.", actions: [{ key: "view", label: "Consultar dados financeiros" }, { key: "manage", label: "Registrar e alterar lançamentos" }] },
];

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [savingPermissionKey, setSavingPermissionKey] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const getToken = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session?.access_token) {
      router.replace("/sistema/login");
      return null;
    }
    return data.session.access_token;
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [{ data: userData, error: userError }, accessToken] = await Promise.all([supabase.auth.getUser(), getToken()]);
      if (userError) throw userError;
      if (!accessToken) return;
      setEmail(userData.user?.email ?? "");
      const response = await fetch("/api/sistema/organizacao", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const result: ApiResult = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível carregar as configurações.");
      if (result.role !== "owner") throw new Error("Somente o proprietário pode alterar as configurações do negócio.");
      if (!result.organization) throw new Error("Não encontramos os dados da organização.");
      setOrganization(result.organization);
      setName(result.organization.name);
      setBusinessType(result.organization.business_type ?? "");

      const teamResponse = await fetch("/api/sistema/equipe", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const teamResult = await teamResponse.json();
      if (!teamResponse.ok || !teamResult.ok) throw new Error(teamResult.message || "Não foi possível carregar as permissões da equipe.");
      setMembers((teamResult.members ?? []).filter((member: TeamMember) => member.role === "member").map((member: TeamMember) => ({ ...member, permissions: normalizeMemberPermissions(member.permissions) })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as configurações.");
    } finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const accessToken = await getToken();
      if (!accessToken) return;
      const response = await fetch("/api/sistema/organizacao", {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: name.trim(), business_type: businessType.trim() }),
      });
      const result: ApiResult = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível salvar as configurações.");
      if (result.organization) setOrganization(result.organization);
      setNotice(result.message || "Configurações salvas.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar as configurações.");
    } finally { setSaving(false); }
  }

  async function changePermission(member: TeamMember, moduleKey: keyof MemberPermissions, actionKey: string, checked: boolean) {
    const permissionKey = `${member.user_id}:${moduleKey}:${actionKey}`;
    setError(""); setNotice(""); setSavingPermissionKey(permissionKey);
    const permissions = JSON.parse(JSON.stringify(member.permissions)) as MemberPermissions;
    const modulePermissions = permissions[moduleKey] as unknown as Record<string, boolean>;
    modulePermissions[actionKey] = checked;
    if (actionKey === "view" && !checked) {
      for (const key of Object.keys(modulePermissions)) if (key !== "view") modulePermissions[key] = false;
    } else if (checked) {
      modulePermissions.view = true;
    }
    const normalized = normalizeMemberPermissions(permissions);
    try {
      const accessToken = await getToken();
      if (!accessToken) return;
      const response = await fetch("/api/sistema/equipe/permissoes", {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ user_id: member.user_id, permissions: normalized }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Não foi possível salvar as permissões.");
      setMembers((current) => current.map((item) => item.user_id === member.user_id ? { ...item, permissions: normalizeMemberPermissions(result.permissions) } : item));
      setNotice(`Permissões de ${member.name || member.email || "colaborador"} atualizadas.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar as permissões.");
    } finally { setSavingPermissionKey(""); }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-[#210039] text-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5"><SystemBrand /><Link href="/sistema" className="rounded-lg border border-purple-300 px-4 py-2 text-sm font-semibold hover:bg-purple-900">← Voltar ao painel</Link></div></header>
      <div className="mx-auto max-w-5xl px-5 py-10">
        <p className="text-sm text-slate-500">Gestão do negócio</p><h1 className="mt-1 text-3xl font-bold">Configurações</h1><p className="mt-2 text-lg text-slate-600">Mantenha os dados da organização e da conta atualizados.</p>
        {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
        {notice && <div role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">{notice}</div>}
        {loading ? <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Carregando configurações…</div> : <>
          <form onSubmit={save} className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Dados do negócio</h2><p className="mt-1 text-sm text-slate-600">Esses dados identificam a organização dentro da plataforma. A apresentação pública é configurada separadamente.</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="text-sm font-medium">Nome da organização<input required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
              <label className="text-sm font-medium">Atividade principal<input required minLength={2} maxLength={100} value={businessType} onChange={(event) => setBusinessType(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Ex.: manutenção e suporte de informática" /></label>
            </div>
            <button disabled={saving || !organization} className="mt-5 rounded-lg bg-purple-700 px-5 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-60">{saving ? "Salvando…" : "Salvar dados do negócio"}</button>
          </form>
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Conta de acesso</h2><label className="mt-4 block max-w-xl text-sm font-medium">E-mail conectado<input readOnly value={email} className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-600" /></label><p className="mt-2 text-sm text-slate-500">Este é o e-mail autenticado. Para alterar e-mail ou senha, use as opções de segurança da conta.</p>
          </section>
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Permissões dos colaboradores</h2>
            <p className="mt-1 text-sm text-slate-600">Escolha o que cada pessoa pode consultar ou alterar. As permissões são salvas ao mudar cada opção; ações de alteração também liberam a consulta do módulo.</p>
            {members.length === 0 ? <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-600">Ainda não há colaboradores vinculados. Depois que alguém aceitar um convite, você poderá definir os acessos aqui. <Link className="font-semibold text-purple-800 underline" href="/sistema/equipe">Convidar ou gerenciar equipe</Link></div> : <div className="mt-5 space-y-5">{members.map((member) => <article key={member.user_id} className="rounded-xl border border-slate-200 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{member.name || "Colaborador"}</h3><p className="text-sm text-slate-600">{member.email}</p></div>{savingPermissionKey.startsWith(`${member.user_id}:`) && <span className="text-sm text-slate-500" role="status">Salvando opção…</span>}</div><div className="mt-4 grid gap-4 lg:grid-cols-2">{permissionModules.map((module) => <section key={module.key} className="rounded-lg bg-slate-50 p-4"><h4 className="font-semibold">{module.title}</h4><p className="mt-1 text-xs text-slate-600">{module.description}</p><div className="mt-3 space-y-2">{module.actions.map((action) => <label key={action.key} className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" checked={Boolean((member.permissions[module.key] as unknown as Record<string, boolean>)[action.key])} disabled={savingPermissionKey === `${member.user_id}:${module.key}:${action.key}`} onChange={(event) => void changePermission(member, module.key, action.key, event.target.checked)} className="mt-0.5 h-4 w-4 accent-purple-700" /><span>{action.label}</span></label>)}</div></section>)}</div></article>)}</div>}
          </section>
          <section className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
            <div><h2 className="text-xl font-semibold">Dados públicos e atendimento</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Configure telefone, WhatsApp, e-mail, área atendida, formas de atendimento, logotipo e publicação da Vitrine.</p></div><Link href="/sistema/vitrine" className="rounded-lg bg-purple-700 px-5 py-3 font-semibold text-white hover:bg-purple-800">Configurar Vitrine →</Link>
          </section>
          <p className="mt-4 text-xs text-slate-500">Organização: {organization?.name} · ID interno: {organization?.id}</p>
        </>}
      </div>
    </main>
  );
}
