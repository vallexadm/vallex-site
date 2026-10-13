"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
type Plan = { id: string; code: string; name: string; monthlyPrice: number; maxUsers: number };
type CurrentPlan = {
  code: string;
  name: string;
  status: string;
  currentPeriodEnd: string | null;
  cancellationPending: boolean;
  canCancel: boolean;
  canReactivateRenewal: boolean;
  subscriptionSyncPending: boolean;
};
type PlanData = { plans: Plan[]; current: CurrentPlan | null };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const loginHref = "/sistema/login?next=%2Fsistema%2Fplanos";
export default function PlanosPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-100 p-6 text-slate-600">Carregando planos...</main>}><PlanosContent /></Suspense>;
}

function PlanosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState(""), [submitting, setSubmitting] = useState("");
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
      if (!token) { router.replace(loginHref); return; }
      try {
        const response = await fetch("/api/sistema/asaas/plans", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
        const result = await response.json();
        if (response.status === 401) { router.replace(loginHref); return; }
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
      const responseText = await response.text();
      let result: { ok?: boolean; message?: string; checkoutUrl?: unknown };
      try {
        result = JSON.parse(responseText);
      } catch {
        const isJson = response.headers.get("content-type")?.includes("application/json");
        throw new Error(
          isJson
            ? `O servidor retornou uma resposta inválida (HTTP ${response.status}). Consulte o terminal do servidor.`
            : `O servidor retornou uma página HTML em vez de JSON (HTTP ${response.status}). Consulte o terminal do servidor.`
        );
      }
      if (!response.ok || !result.ok || typeof result.checkoutUrl !== "string") throw new Error(result.message ?? "Não foi possível iniciar o checkout.");
      window.location.assign(result.checkoutUrl);
    } catch (e) { setError(planCode.toUpperCase() + ": " + (e instanceof Error ? e.message : "Erro ao iniciar o checkout.")); setSubmitting(""); }
  }
  async function manageRenewal(action: "cancel" | "reactivate" | "sync") {
    setError("");
    setNotice("");
    setSubmitting(action);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { router.replace("/sistema/login"); return; }
      const response = await fetch(`/api/sistema/asaas/subscription/${action}`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      const responseText = await response.text();
      let result: {
        ok?: boolean;
        message?: string;
        alreadySynced?: boolean;
        descriptionUpdated?: boolean;
        description?: string;
      };
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`O servidor retornou uma resposta inválida (HTTP ${response.status}). Consulte o terminal.`);
      }
      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Não foi possível atualizar a renovação.");
      }
      if (action === "sync" && result.alreadySynced && result.descriptionUpdated) {
        setNotice("Descrição da assinatura atualizada.");
        setSubmitting("");
        return;
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar a renovação.");
      setSubmitting("");
    }
  }
  return <main className="min-h-screen bg-slate-100">
    <header className="bg-[#17002E] px-6 py-5 text-white"><div className="mx-auto flex max-w-6xl items-center justify-between"><div><p className="text-sm tracking-[0.2em] text-purple-300">VALLEX</p><h1 className="text-xl font-bold">ServiçoFácil</h1></div><Link href="/sistema" className="rounded-lg border border-purple-300 px-4 py-2 text-sm hover:bg-purple-900">Voltar ao painel</Link></div></header>
    <section className="mx-auto max-w-6xl px-6 py-10"><p className="text-sm text-slate-500">Gestão da organização</p><h2 className="mt-2 text-3xl font-bold text-slate-900">Planos e assinatura</h2><p className="mt-3 text-slate-600">Escolha o plano que acompanha o crescimento da sua empresa.</p>
      {message && <p role="status" className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">{message}</p>}{notice && <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">{notice}</p>}{error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
      {loading ? <p className="mt-8 rounded-xl bg-white p-6 text-slate-600">Carregando planos...</p> : data && <>
        {data.current && <div className="mt-6 rounded-xl border border-purple-200 bg-white p-4 text-slate-700">
          <p>Plano atual: <strong>{data.current.name}</strong> · Status: <strong>{data.current.cancellationPending ? "renovação cancelada" : data.current.status}</strong>
            {data.current.currentPeriodEnd ? ` · ${data.current.cancellationPending ? "Acesso até" : data.current.status === "expired" ? "Vencido em" : "Próxima renovação"}: ${new Date(data.current.currentPeriodEnd).toLocaleDateString("pt-BR")}` : ""}
          </p>
          {data.current.subscriptionSyncPending && <p className="mt-2 text-sm text-amber-700">O checkout foi pago, mas o ID da assinatura ainda não foi associado. Sincronize a assinatura para habilitar o cancelamento.</p>}
          {data.current.cancellationPending && <p className="mt-2 text-sm text-slate-600">Seu acesso permanece ativo até o fim do período já pago.</p>}
        </div>}
        <div className="mt-8 grid gap-5 md:grid-cols-3">{data.plans.map((plan) => {
          const current = data.current?.code === plan.code && data.current.status === "active";
          const paid = plan.monthlyPrice > 0;
          const reactivatingExpiredPlan =
            paid && data.current?.code === plan.code && data.current.status !== "active";
          return <article key={plan.id} className={"flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-purple-500 hover:shadow-lg focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100 " + (current ? "border-purple-400 ring-2 ring-purple-100" : "border-slate-200")}>
            <p className="text-sm font-semibold uppercase tracking-wide text-purple-700">{plan.name}</p>
            <p className="mt-4 text-3xl font-bold text-slate-900">{money.format(plan.monthlyPrice)}<span className="text-base font-normal text-slate-500"> / mês</span></p>
            <p className="mt-3 text-sm text-slate-600">Até {plan.maxUsers} {plan.maxUsers === 1 ? "usuário" : "usuários"} na equipe.</p>
            {plan.code === "free" && <p className="mt-2 text-sm text-slate-600">Acesso inicial para conhecer a plataforma.</p>}
            {paid && <p className="mt-2 text-sm text-slate-600">Cobrança recorrente mensal pelo Asaas, paga com cartão de crédito.</p>}
            <div className="mt-auto space-y-3 pt-6">
              {current ? <>
                <button disabled className="w-full rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-500">Plano atual</button>
                {data.current?.canCancel && <button onClick={() => {
                  const endDate = data.current?.currentPeriodEnd
                    ? new Date(data.current.currentPeriodEnd).toLocaleDateString("pt-BR")
                    : "o fim do período pago";
                  if (window.confirm(`A renovação será interrompida e seu acesso continuará até ${endDate}. Cobranças já geradas no Asaas permanecem válidas. Deseja cancelar?`)) {
                    manageRenewal("cancel");
                  }
                }} disabled={Boolean(submitting)} className="w-full rounded-lg border border-red-300 px-4 py-3 font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60">
                  {submitting === "cancel" ? "Cancelando renovação..." : "Cancelar plano"}
                </button>}
                {data.current?.subscriptionSyncPending && <button onClick={() => manageRenewal("sync")} disabled={Boolean(submitting)} className="w-full rounded-lg border border-amber-300 px-4 py-3 font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60">
                  {submitting === "sync" ? "Sincronizando assinatura..." : "Sincronizar assinatura"}
                </button>}
                {data.current?.canReactivateRenewal && <button onClick={() => manageRenewal("reactivate")} disabled={Boolean(submitting)} className="w-full rounded-lg bg-purple-700 px-4 py-3 font-semibold text-white transition hover:bg-purple-800 disabled:cursor-wait disabled:opacity-60">
                  {submitting === "reactivate" ? "Reativando renovação..." : "Reativar renovação"}
                </button>}
              </> : paid ? <button onClick={() => checkout(plan.code)} disabled={Boolean(submitting)} className={"w-full rounded-lg px-4 py-3 font-semibold text-white transition " + (submitting === plan.code ? "cursor-wait bg-slate-400" : submitting ? "cursor-not-allowed bg-purple-700" : "bg-purple-700 hover:bg-purple-800")}>
                {submitting === plan.code ? "Preparando checkout..." : (reactivatingExpiredPlan ? "Reativar " : "Contratar ") + plan.name}
              </button> : <span className="block rounded-lg bg-slate-100 px-4 py-3 text-center font-medium text-slate-600">Plano gratuito</span>}
            </div>
          </article>;
        })}</div>
        <p className="mt-6 text-sm text-slate-500">O retorno do checkout não confirma o pagamento. A alteração do plano depende da confirmação recebida do Asaas.</p>
      </>}
    </section>
  </main>;
}




