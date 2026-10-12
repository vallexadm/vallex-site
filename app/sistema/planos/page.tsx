"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
type Plan = { id: string; code: string; name: string; monthlyPrice: number; maxUsers: number };
type PlanData = { plans: Plan[]; current: { code: string; name: string; status: string; currentPeriodEnd: string | null } | null };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export default function PlanosPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-100 p-6 text-slate-600">Carregando planos...</main>}><PlanosContent /></Suspense>;
}

function PlanosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [submitting, setSubmitting] = useState("");
  const paymentMessages: Record<string, string> = {
    retorno: "Você voltou do checkout. A assinatura só será ativada quando o Asaas confirmar o pagamento.",
    cancelado: "Checkout cancelado. Você pode iniciar uma nova contratação quando quiser.",
    expirado: "O checkout expirou. Você pode gerar um novo link de pagamento.",
  };
  const message = paymentMessages[searchParams.get("pagamento") ?? ""] ?? "";
  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { router.replace("/sistema/login"); return; }
      try {
        const response = await fetch("/api/sistema/asaas/plans", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
        const result = await response.json();
        if (response.status === 401) { router.replace("/sistema/login"); return; }
        if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível carregar os planos.");
        setData(result);
      } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar os planos."); }
      finally { setLoading(false); }
    }
    load();
  }, [router]);
  async function checkout(planCode: string) {
    setError(""); setSubmitting(planCode);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { router.replace("/sistema/login"); return; }
      const response = await fetch("/api/sistema/asaas/checkout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ planCode }) });
      const result = await response.json();
      if (!response.ok || !result.ok || typeof result.checkoutUrl !== "string") throw new Error(result.message ?? "Não foi possível iniciar o checkout.");
      window.location.assign(result.checkoutUrl);
    } catch (e) { setError(planCode.toUpperCase() + ": " + (e instanceof Error ? e.message : "Erro ao iniciar o checkout.")); setSubmitting(""); }
  }
  return <main className="min-h-screen bg-slate-100">
    <header className="bg-[#17002E] px-6 py-5 text-white"><div className="mx-auto flex max-w-6xl items-center justify-between"><div><p className="text-sm tracking-[0.2em] text-purple-300">VALLEX</p><h1 className="text-xl font-bold">ServiçoFácil</h1></div><Link href="/sistema" className="rounded-lg border border-purple-300 px-4 py-2 text-sm hover:bg-purple-900">Voltar ao painel</Link></div></header>
    <section className="mx-auto max-w-6xl px-6 py-10"><p className="text-sm text-slate-500">Gestão da organização</p><h2 className="mt-2 text-3xl font-bold text-slate-900">Planos e assinatura</h2><p className="mt-3 text-slate-600">Escolha o plano que acompanha o crescimento da sua empresa.</p>
      {message && <p role="status" className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">{message}</p>}{error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
      {loading ? <p className="mt-8 rounded-xl bg-white p-6 text-slate-600">Carregando planos...</p> : data && <>
        {data.current && <p className="mt-6 rounded-xl border border-purple-200 bg-white p-4 text-slate-700">Plano atual: <strong>{data.current.name}</strong> · Status: <strong>{data.current.status}</strong>{data.current.currentPeriodEnd ? " · Próxima renovação: " + new Date(data.current.currentPeriodEnd).toLocaleDateString("pt-BR") : ""}</p>}
        <div className="mt-8 grid gap-5 md:grid-cols-3">{data.plans.map((plan) => { const current = data.current?.code === plan.code && data.current.status === "active"; const paid = plan.monthlyPrice > 0; return <article key={plan.id} className={"flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-purple-500 hover:shadow-lg focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100 " + (current ? "border-purple-400 ring-2 ring-purple-100" : "border-slate-200")}>
          <p className="text-sm font-semibold uppercase tracking-wide text-purple-700">{plan.name}</p><p className="mt-4 text-3xl font-bold text-slate-900">{money.format(plan.monthlyPrice)}<span className="text-base font-normal text-slate-500"> / mês</span></p><p className="mt-3 text-sm text-slate-600">Até {plan.maxUsers} {plan.maxUsers === 1 ? "usuário" : "usuários"} na equipe.</p>
          {plan.code === "free" && <p className="mt-2 text-sm text-slate-600">Acesso inicial para conhecer a plataforma.</p>}{paid && <p className="mt-2 text-sm text-slate-600">Cobrança recorrente mensal pelo Asaas, paga com cartão de crédito.</p>}
          <div className="mt-auto pt-6">{current ? <button disabled className="w-full rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-500">Plano atual</button> : paid ? <button onClick={() => checkout(plan.code)} disabled={Boolean(submitting)} className={"w-full rounded-lg px-4 py-3 font-semibold text-white transition " + (submitting === plan.code ? "cursor-wait bg-slate-400" : submitting ? "cursor-not-allowed bg-purple-700" : "bg-purple-700 hover:bg-purple-800")}>{submitting === plan.code ? "Preparando checkout..." : "Contratar " + plan.name}</button> : <span className="block rounded-lg bg-slate-100 px-4 py-3 text-center font-medium text-slate-600">Plano gratuito</span>}</div>
        </article>; })}</div><p className="mt-6 text-sm text-slate-500">O retorno do checkout não confirma o pagamento. A alteração do plano depende da confirmação recebida do Asaas.</p>
      </>}
    </section>
  </main>;
}




