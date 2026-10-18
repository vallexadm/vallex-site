"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { SUPPORT_TOOLS } from "@/lib/support-tools";

type OrganizationContext = {
  organization?: { name: string };
  plan?: { code: string; name: string };
};

type ProviderSupportRequest = {
  id: string;
  servico: string;
  descricao: string;
  ferramenta: string | null;
  plano_nome: string | null;
  status: string;
  criado_em: string;
};

const statusLabels: Record<string, string> = {
  novo: "Recebido",
  em_contato: "Em atendimento",
  orcamento_enviado: "Retorno enviado",
  agendado: "Agendado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export default function SistemaSuportePage() {
  const router = useRouter();
  const [context, setContext] = useState<OrganizationContext | null>(null);
  const [requests, setRequests] = useState<ProviderSupportRequest[]>([]);
  const [tool, setTool] = useState<string>(SUPPORT_TOOLS[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadContext() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          router.replace("/sistema/login");
          return;
        }
        const response = await fetch("/api/sistema/organizacao", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível consultar seu plano.");
        const requestsResponse = await fetch("/api/sistema/suporte", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const requestsResult = await requestsResponse.json();
        if (!requestsResponse.ok || !requestsResult.ok) throw new Error(requestsResult.message ?? "Não foi possível carregar suas solicitações de suporte.");
        if (!cancelled) setRequests(requestsResult.solicitacoes ?? []);
        if (!cancelled) setContext(result);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados do negócio.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadContext();
    return () => { cancelled = true; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    setNotice("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/sistema/suporte", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ferramenta: tool, servico: subject.trim(), descricao: description.trim(), telefone: phone.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível enviar sua solicitação.");
      setNotice(result.message ?? "Solicitação enviada ao suporte VALLEX.");
      setSubject("");
      setDescription("");
      setPhone("");
      const requestsResponse = await fetch("/api/sistema/suporte", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const requestsResult = await requestsResponse.json();
      if (requestsResponse.ok && requestsResult.ok) setRequests(requestsResult.solicitacoes ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao enviar a solicitação.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-[#210039] text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-5">
          <div><Link href="/sistema" className="text-lg font-bold tracking-wide text-purple-200">VALLEX <span className="font-medium text-white">ServiçoFácil</span></Link><p className="mt-1 text-sm text-purple-200">Suporte ao prestador</p></div>
          <Link href="/sistema" className="rounded-lg border border-purple-300 px-4 py-2 text-sm font-semibold transition hover:bg-purple-900">← Voltar ao painel</Link>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-5 py-10">
        <p className="text-sm font-medium text-violet-700">ATENDIMENTO VALLEX</p>
        <h1 className="mt-2 text-3xl font-bold">Como podemos ajudar?</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Escolha a ferramenta relacionada à sua dúvida. A solicitação será identificada com seu negócio e plano para a equipe encaminhar corretamente.</p>
        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
        {notice && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
        <form onSubmit={submit} className="mt-7 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Negócio</p><p className="mt-1 font-semibold">{loading ? "Carregando…" : context?.organization?.name ?? "Conta conectada"}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plano atual</p><p className="mt-1 font-semibold">{loading ? "Carregando…" : context?.plan?.name ?? "Plano não identificado"}</p></div>
          </div>
          <label className="block text-sm font-semibold">Ferramenta relacionada
            <select required value={tool} onChange={(event) => setTool(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200">
              {SUPPORT_TOOLS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Assunto
            <input required minLength={3} maxLength={100} value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200" placeholder="Ex.: não consigo publicar minha vitrine" />
          </label>
          <label className="block text-sm font-semibold">Descreva como podemos ajudar
            <textarea required minLength={10} maxLength={3000} rows={6} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200" placeholder="Conte o que aconteceu e quais passos você já tentou." />
          </label>
          <label className="block text-sm font-semibold">WhatsApp ou telefone para retorno
            <input required type="tel" minLength={8} maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200" placeholder="(62) 99999-9999" />
          </label>
          <p className="text-xs leading-5 text-slate-500">A equipe receberá esta solicitação como enviada pelo acesso do prestador, junto com o plano atual e a ferramenta escolhida.</p>
          <button type="submit" disabled={loading || sending} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-purple-700 px-6 font-semibold text-white transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{sending ? "Enviando…" : "Enviar solicitação"}</button>
        </form>
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="support-history-heading">
          <h2 id="support-history-heading" className="text-xl font-bold">Minhas solicitações</h2>
          <p className="mt-1 text-sm text-slate-600">Acompanhe o andamento dos pedidos enviados pelo acesso do prestador.</p>
          {loading ? <p className="mt-5 text-sm text-slate-500">Carregando histórico…</p> : requests.length === 0 ? <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Você ainda não enviou solicitações.</p> : <div className="mt-5 grid gap-3">{requests.map((request) => <article key={request.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{request.servico}</h3><p className="mt-1 text-xs text-slate-500">{request.ferramenta ?? "Suporte geral"} · {request.plano_nome ?? "Plano não informado"} · {new Date(request.criado_em).toLocaleDateString("pt-BR", { dateStyle: "medium" })}</p></div><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">{statusLabels[request.status] ?? request.status}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{request.descricao}</p></article>)}</div>}
        </section>
      </section>
    </main>
  );
}
