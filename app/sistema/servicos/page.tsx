"use client";

import ActionNotice from "@/components/ActionNotice";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SystemBrand from "@/components/SystemBrand";
import { supabase } from "@/lib/supabase/client";
import { defaultMemberPermissions, normalizeMemberPermissions, type MemberPermissions } from "@/lib/team-permissions";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number | string | null;
  is_published: boolean;
  display_order: number;
};

type ApiResult = { ok: boolean; message?: string; permissions?: MemberPermissions; services?: Service[]; service?: Service; plan?: { code: string; maxServices: number | null; publishedServiceCount: number } };

function money(value: number | string | null) {
  if (value === null || value === "") return "A combinar";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

export default function ServicosPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [permissions, setPermissions] = useState<MemberPermissions>(defaultMemberPermissions);
  const [serviceLimit, setServiceLimit] = useState<number | null>(null);
  const [publishedServiceCount, setPublishedServiceCount] = useState(0);
  const canManageServices = permissions.services.manage;
  const serviceLimitReached = serviceLimit !== null && publishedServiceCount >= serviceLimit;
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingService = services.find((service) => service.id === editingId);
  const canPublishCurrentService = !serviceLimitReached || editingService?.is_published === true;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [published, setPublished] = useState(false);
  const [order, setOrder] = useState("1");

  const token = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session?.access_token) {
      router.replace("/sistema/login");
      return null;
    }
    return data.session.access_token;
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const accessToken = await token();
      if (!accessToken) return;
      const response = await fetch("/api/sistema/vitrine/servicos", {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
      });
      const result: ApiResult = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível carregar os serviços.");
      setServices(result.services ?? []);
      setPermissions(normalizeMemberPermissions(result.permissions));
      setServiceLimit(result.plan?.maxServices ?? null);
      const activeCount = result.plan?.publishedServiceCount ?? (result.services ?? []).filter((service) => service.is_published).length;
      setPublishedServiceCount(activeCount);
      if (!editingId) setPublished(result.plan?.maxServices == null || activeCount < result.plan.maxServices);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os serviços.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice("");
    setPublished(serviceLimit === null || publishedServiceCount < serviceLimit);
    setOrder(String(services.length ? Math.max(...services.map((item) => item.display_order)) + 1 : 1));
  }

  function edit(service: Service) {
    setEditingId(service.id);
    setName(service.name);
    setDescription(service.description ?? "");
    setPrice(service.price === null ? "" : String(service.price));
    setPublished(service.is_published);
    setOrder(String(service.display_order));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice(""); setSaving(true);
    try {
      const accessToken = await token();
      if (!accessToken) return;
      const response = await fetch("/api/sistema/vitrine/servicos", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), name: name.trim(), description: description.trim(), price: price.trim() ? Number(price.replace(",", ".")) : null, is_published: published, display_order: Number(order) }),
      });
      const result: ApiResult = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível salvar o serviço.");
      setNotice(editingId ? "Serviço atualizado." : "Serviço cadastrado.");
      resetForm();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o serviço.");
    } finally { setSaving(false); }
  }

  async function update(service: Service, values: Partial<Service>) {
    setError(""); setNotice("");
    try {
      const accessToken = await token();
      if (!accessToken) return;
      const response = await fetch("/api/sistema/vitrine/servicos", {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: service.id, ...values }),
      });
      const result: ApiResult = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível atualizar o serviço.");
      setNotice(values.is_published === undefined ? "Ordem de exibição atualizada." : values.is_published ? "Serviço publicado na Vitrine." : "Serviço removido da Vitrine.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o serviço."); }
  }

  async function remove(service: Service) {
    if (!window.confirm(`Excluir “${service.name}”?`)) return;
    setError(""); setNotice("");
    try {
      const accessToken = await token();
      if (!accessToken) return;
      const response = await fetch("/api/sistema/vitrine/servicos", {
        method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ id: service.id }),
      });
      const result: ApiResult = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível excluir o serviço.");
      setNotice("Serviço excluído.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir o serviço."); }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-[#210039] text-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5"><SystemBrand /><Link href="/sistema" className="rounded-lg border border-purple-300 px-4 py-2 text-sm font-semibold hover:bg-purple-800">← Voltar ao painel</Link></div></header>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-sm text-slate-500">Gestão do negócio</p><h1 className="mt-1 text-3xl font-bold">Serviços</h1><p className="mt-2 text-lg text-slate-600">Cadastre o catálogo, os valores e o que será exibido na Vitrine pública.</p>
        <aside className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-5 text-sm text-violet-950">
          <h2 className="font-semibold">Como este catálogo funciona</h2>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>Cadastre os serviços que você ou sua empresa oferece e informe um preço ou deixe “a combinar”.</li>
            <li>“Mostrar na Vitrine” permite que o serviço apareça na página pública do prestador.</li>
            <li>Isso não registra um trabalho realizado nem lança receita. Depois do atendimento, registre o serviço no Financeiro.</li>
          </ol>
          <p className="mt-2">Em resumo: este é o catálogo de ofertas; o Financeiro registra os serviços efetivamente realizados.</p>
        </aside>
        {error && <ActionNotice message={error} error onClose={() => setError("")} />}
        {notice && <ActionNotice message={notice} onClose={() => setNotice("")} />}
        {canManageServices && <form onSubmit={save} className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">{editingId ? "Editar serviço" : "Adicionar serviço"}</h2>
          <p className="mt-1 text-sm text-slate-600">Deixe o preço em branco quando for necessário avaliar antes de orçar. {serviceLimit === null ? "Seu plano não possui limite de serviços publicados." : `Plano atual: ${publishedServiceCount} de ${serviceLimit} serviço(s) ativo(s) na Vitrine.`}</p>
          {serviceLimitReached && !editingService?.is_published && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Você atingiu o limite de serviços publicados. Oculte outro serviço para liberar uma vaga ou consulte os planos.</p>}
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-medium">Nome do serviço<input required minLength={2} maxLength={160} value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Ex.: Manutenção de computador" /></label>
            <label className="text-sm font-medium">Preço de referência (R$)<input type="number" min="0" max="9999999999.99" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Deixe vazio se for sob orçamento" /></label>
            <label className="text-sm font-medium md:col-span-2">Descrição<textarea maxLength={2000} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Explique o que está incluído no serviço." /></label>
            <label className="text-sm font-medium">Ordem no catálogo<input type="number" min="0" max="999" step="1" value={order} onChange={(e) => setOrder(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
            <label className="flex cursor-pointer items-center gap-3 self-end rounded-lg border border-slate-300 p-3"><input type="checkbox" checked={published} disabled={!canPublishCurrentService} onChange={(e) => setPublished(e.target.checked)} className="h-4 w-4 accent-purple-700 disabled:cursor-not-allowed" /><span><span className="block font-medium">Mostrar na Vitrine pública</span><span className="block text-xs text-slate-500">A publicação da Vitrine também precisa estar ativa.{!canPublishCurrentService ? " Oculte outro serviço para liberar uma vaga." : ""}</span></span></label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3"><button disabled={saving} className="rounded-lg bg-purple-700 px-5 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-60">{saving ? "Salvando…" : editingId ? "Salvar alterações" : "Cadastrar serviço"}</button>{editingId && <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 px-5 py-3 font-semibold">Cancelar edição</button>}</div>
        </form>}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Catálogo cadastrado</h2>{canManageServices && <p className="mt-1 text-sm text-slate-600">{serviceLimit === null ? `${publishedServiceCount} serviço(s) ativo(s) na Vitrine` : `${publishedServiceCount} de ${serviceLimit} serviço(s) ativo(s) na Vitrine`}</p>}{!canManageServices && <p className="mt-1 text-sm text-slate-600">Acesso somente para consulta.</p>}</div>{canManageServices && <Link className="font-semibold text-purple-800 underline" href="/sistema/vitrine">Ver configurações da Vitrine →</Link>}</div>
          {loading ? <p className="mt-5 text-slate-600">Carregando serviços…</p> : services.length === 0 ? <div className="mt-5 rounded-lg border border-dashed border-slate-300 p-8 text-center"><p className="font-semibold">Nenhum serviço cadastrado ainda.</p><p className="mt-1 text-sm text-slate-600">{canManageServices ? "Use o formulário acima para criar o primeiro item do catálogo." : "Ainda não há serviços para exibir."}</p></div> : <ul className="mt-5 space-y-3">{services.map((service) => <li key={service.id} className="rounded-xl border border-slate-200 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{service.name}</h3><span className={`rounded-full px-3 py-1 text-xs font-semibold ${service.is_published ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>{service.is_published ? "Visível na Vitrine" : "Oculto da Vitrine"}</span></div>{service.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{service.description}</p>}<p className="mt-3 text-sm"><strong>{money(service.price)}</strong><span className="ml-4 text-slate-500">Posição {service.display_order}</span></p></div>{canManageServices && <div className="flex flex-wrap gap-2"><button onClick={() => edit(service)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Editar</button><button onClick={() => void update(service, { is_published: !service.is_published })} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800">{service.is_published ? "Ocultar" : "Exibir"}</button><button onClick={() => void remove(service)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700">Excluir</button></div>}</div></li>)}</ul>}
        </section>
      </div>
    </main>
  );
}
