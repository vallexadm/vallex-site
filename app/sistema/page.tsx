"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import LocalClock from "@/components/LocalClock";
import { defaultMemberPermissions, normalizeMemberPermissions, type MemberPermissions } from "@/lib/team-permissions";

type OwnerDashboardMetrics = { charged: number; received: number; receivable: number; expenses: number; pendingBills: number; estimatedProfit: number };

function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${day}`, label: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
}

function formatDashboardCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function SistemaPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(true);
  const [organizationName, setOrganizationName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [role, setRole] = useState("");
  const [isVallexAdmin, setIsVallexAdmin] = useState(false);
  const [modulePermissions, setModulePermissions] = useState<MemberPermissions>(defaultMemberPermissions);
  const [contextError, setContextError] = useState("");
  const [needsOrganization, setNeedsOrganization] = useState(false);
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [dashboardMetrics, setDashboardMetrics] = useState<OwnerDashboardMetrics | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  useEffect(() => {
    async function checkSession() {
  setNeedsOrganization(false);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    router.replace("/sistema/login");
    return;
  }

  setEmail(data.user.email ?? "");
  const metadata = data.user.user_metadata ?? {};


  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    setContextError("Não foi possível obter a sessão autenticada.");
    setChecking(false);
    return;
  }

  try {
    const adminAccessResponse = await fetch("/api/admin/access", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (adminAccessResponse.ok) {
      const adminAccess = await adminAccessResponse.json();
      setIsVallexAdmin(adminAccess.isAdmin === true || adminAccess.isStaff === true);
    }
  } catch {
    // A conta continua acessível mesmo quando a verificação administrativa falha.
  }

  try {
    const response = await fetch("/api/sistema/organizacao", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const result = await response.json();

    if (
      response.status === 404 &&
      result.code === "ORGANIZATION_NOT_FOUND"
    ) {
  setOrganizationName(
    typeof metadata.organization_name === "string"
      ? metadata.organization_name
      : ""
  );
  setBusinessType(
    typeof metadata.business_type === "string" ? metadata.business_type : ""
  );
      setNeedsOrganization(true);
      setChecking(false);
      return;
    }

    if (!response.ok || !result.ok) {
      setContextError(
        result.message ?? "Não foi possível carregar a organização."
      );
      setChecking(false);
      return;
    }

    setContextError("");
    setOrganizationName(result.organization.name);
    setBusinessType(result.organization.business_type ?? "");
    setRole(result.role);
    setModulePermissions(normalizeMemberPermissions(result.permissions?.modules));
  } catch {
    setContextError("Erro ao consultar os dados da organização.");
  }

  setChecking(false);
}

    void checkSession();
    const revalidate = () => { void checkSession(); };
    window.addEventListener("focus", revalidate);
    const timer = window.setInterval(revalidate, 30000);
    return () => { window.removeEventListener("focus", revalidate); window.clearInterval(timer); };
  }, [router]);

  useEffect(() => {
    if (role !== "owner") return;
    let cancelled = false;
    async function loadOwnerOverview() {
      setLoadingDashboard(true);
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) return;
        const range = currentMonthRange();
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [financeResponse, receivablesResponse] = await Promise.all([
          fetch(`/api/sistema/financeiro?from=${range.from}&to=${range.to}`, { headers, cache: "no-store" }),
          fetch("/api/sistema/financeiro?receivables=all", { headers, cache: "no-store" }),
        ]);
        if (!financeResponse.ok || !receivablesResponse.ok) return;
        const [finance, receivables] = await Promise.all([financeResponse.json(), receivablesResponse.json()]);
        if (!finance.ok || !receivables.ok) return;
        const services = finance.services ?? [];
        const expenses = finance.expenses ?? [];
        const charged = services.reduce((sum: number, service: { amount_charged: number | string }) => sum + Number(service.amount_charged), 0);
        const directCosts = services.reduce((sum: number, service: { direct_cost: number | string }) => sum + Number(service.direct_cost), 0);
        const received = (finance.payments ?? []).reduce((sum: number, payment: { amount: number | string }) => sum + Number(payment.amount), 0);
        const expensesTotal = expenses.reduce((sum: number, expense: { amount: number | string }) => sum + Number(expense.amount), 0);
        if (!cancelled) setDashboardMetrics({
          charged,
          received,
          receivable: (receivables.receivables ?? []).reduce((sum: number, service: { amount_charged: number | string; amount_received: number | string }) => sum + Math.max(0, Number(service.amount_charged) - Number(service.amount_received)), 0),
          expenses: expensesTotal,
          pendingBills: expenses.filter((expense: { payment_status: string }) => expense.payment_status === "pendente").length,
          estimatedProfit: charged - directCosts - expensesTotal,
        });
      } catch {
        // O painel continua navegável mesmo quando o resumo financeiro não carregar.
      } finally {
        if (!cancelled) setLoadingDashboard(false);
      }
    }
    void loadOwnerOverview();
    return () => { cancelled = true; };
  }, [role]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/sistema/login");
  }

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContextError("");
    setSavingOrganization(true);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        router.replace("/sistema/login");
        return;
      }

      const response = await fetch("/api/sistema/organizacao", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: organizationName,
          business_type: businessType,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Não foi possível criar sua área.");
      }

      setContextError("");
    setOrganizationName(result.organization.name);
      setBusinessType(result.organization.business_type ?? businessType);
      setRole("owner");
      setNeedsOrganization(false);
      router.replace("/sistema/planos?acesso=painel");
    } catch (error) {
      setContextError(
        error instanceof Error
          ? error.message
          : "Não foi possível configurar sua área. Tente novamente."
      );
    } finally {
      setSavingOrganization(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Verificando acesso...
      </main>
    );
  }

  if (needsOrganization) {
    return (
      <main className="min-h-screen bg-slate-100">
        <header className="bg-[#17002E] px-4 py-4 text-white sm:px-6 sm:py-5">
          <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
            <div className="flex items-center justify-center gap-3">
              <Image
                src="/vallex-logo.png"
                alt="VALLEX"
                width={7271}
                height={5879}
                priority
                className="h-12 w-14 object-contain sm:h-[54px] sm:w-[66px]"
              />
              <h1 className="text-lg font-bold text-purple-200 sm:text-xl">ServiçoFácil</h1>
            </div>
            <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:gap-3">
              <LocalClock variant="dark" />
              {isVallexAdmin && <Link href="/admin" className="rounded-lg border border-purple-300 px-4 py-2 text-center text-sm hover:bg-purple-800">Admin VALLEX</Link>}
              <button
                onClick={handleLogout}
                className="rounded-lg border border-purple-300 px-4 py-2 text-center text-sm hover:bg-purple-800"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-3xl px-6 py-10">
          <p className="text-sm text-slate-500">Primeiro acesso</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            Configure sua área de prestador
          </h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Confirme os dados do seu negócio. Em seguida, você poderá configurar
            a Vitrine pública e cadastrar seus serviços.
          </p>

          <form
            onSubmit={handleCreateOrganization}
            className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div>
              <label
                htmlFor="organization-name"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Nome do prestador ou da empresa
              </label>
              <input
                id="organization-name"
                required
                minLength={2}
                maxLength={160}
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
                placeholder="Ex.: Silva Serviços"
              />
            </div>

            <div>
              <label
                htmlFor="business-type"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Atividade principal
              </label>
              <input
                id="business-type"
                required
                minLength={2}
                maxLength={100}
                value={businessType}
                onChange={(event) => setBusinessType(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
                placeholder="Ex.: serviços elétricos, informática"
              />
            </div>

            <p className="text-sm text-slate-500">
              Sua área começa com 30 dias grátis do plano Basic, sem cobrança.
              Depois do teste, a conta volta ao Free. A Vitrine será criada
              como não publicada; você decide quando torná-la pública.
            </p>

            {contextError && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {contextError}
              </p>
            )}

            <button
              type="submit"
              disabled={savingOrganization}
              className="w-full rounded-lg bg-violet-700 px-4 py-3 font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {savingOrganization ? "Configurando..." : "Criar minha área"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-[#17002E] px-4 py-4 text-white sm:px-6 sm:py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
          <div className="flex items-center justify-center gap-3">
            <Image
              src="/vallex-logo.png"
              alt="VALLEX"
              width={7271}
              height={5879}
              priority
              className="h-12 w-14 object-contain sm:h-[54px] sm:w-[66px]"
            />
            <h1 className="text-lg font-bold text-purple-200 sm:text-xl">ServiçoFácil</h1>
          </div>

          <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:gap-3">
            <LocalClock variant="dark" />
            {isVallexAdmin && <Link href="/admin" className="rounded-lg border border-purple-300 px-4 py-2 text-center text-sm hover:bg-purple-800">Admin VALLEX</Link>}
            <button
              onClick={handleLogout}
              className="rounded-lg border border-purple-300 px-4 py-2 text-center text-sm hover:bg-purple-800"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-slate-500">Painel de gestão</p>

        <h2 className="mt-2 text-3xl font-bold text-slate-900">
          Bem-vindo ao ServiçoFácil!
        </h2>

    <p className="mt-2 text-slate-600">
  Acesso autenticado: {email}
</p>

{contextError ? (
  <p className="mt-2 text-sm text-red-600">
    {contextError}
  </p>
) : (
  <p className="mt-2 text-sm text-slate-600">
    Organização: <strong>{organizationName}</strong>
    {" · "}
    Perfil: <strong>
      {role === "owner" ? "Proprietário" : "Colaborador"}
    </strong>
  </p>
)}
        {role === "owner" && (
          <section aria-labelledby="owner-dashboard-heading" className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-sm font-medium capitalize text-violet-700">Visão geral · {currentMonthRange().label}</p><h3 id="owner-dashboard-heading" className="mt-1 text-xl font-semibold text-slate-900">Resumo do negócio</h3></div>
              <Link href="/sistema/financeiro" className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-800 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-500 hover:bg-violet-50 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2">Abrir financeiro <span aria-hidden="true">→</span></Link>
            </div>
            {loadingDashboard && <p className="mt-4 text-sm text-slate-500">Carregando indicadores…</p>}
            {dashboardMetrics ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {[
                { label: "Faturamento", value: dashboardMetrics.charged, hint: "Serviços no mês", style: "border-blue-200 bg-blue-50 text-blue-900" },
                { label: "Recebido", value: dashboardMetrics.received, hint: "Pagamentos no mês", style: "border-emerald-200 bg-emerald-50 text-emerald-900" },
                { label: "A receber", value: dashboardMetrics.receivable, hint: "Saldo aberto de clientes", style: "border-amber-200 bg-amber-50 text-amber-900" },
                { label: "Despesas", value: dashboardMetrics.expenses, hint: `${dashboardMetrics.pendingBills} conta(s) pendente(s) no mês`, style: "border-orange-200 bg-orange-50 text-orange-900" },
                { label: "Resultado estimado", value: dashboardMetrics.estimatedProfit, hint: "Faturamento − custos e despesas", style: dashboardMetrics.estimatedProfit >= 0 ? "border-teal-200 bg-teal-50 text-teal-900" : "border-red-200 bg-red-50 text-red-900" },
              ].map((metric) => <article key={metric.label} className={`rounded-xl border p-5 shadow-sm ${metric.style}`}><p className="text-sm font-medium">{metric.label}</p><p className="mt-2 text-2xl font-bold">{formatDashboardCurrency(metric.value)}</p><p className="mt-1 text-xs opacity-80">{metric.hint}</p></article>)}
            </div> : !loadingDashboard && <p className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Os indicadores não estão disponíveis agora. Você ainda pode acessar os módulos abaixo.</p>}
          </section>
        )}
        <div className="mt-8 flex flex-wrap items-end justify-between gap-2"><div><p className="text-sm font-medium text-violet-700">Navegação</p><h3 className="mt-1 text-xl font-semibold text-slate-900">Acessos rápidos</h3></div><p className="text-sm text-slate-500">Selecione uma área para abrir o módulo.</p></div>
        {role === "owner" && (
        <div className="mt-6">
  <Link
    href="/sistema/solicitacoes"
    className="group flex flex-col gap-2 rounded-xl border border-purple-200 bg-white p-6 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-purple-400 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 sm:flex-row sm:items-center sm:justify-between"
  >
    <div>
      <h3 className="text-lg font-semibold text-slate-900">
        Solicitações recebidas
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Consulte os pedidos enviados pelo formulário do site e entre em contato
        com os interessados.
      </p>
    </div>

    <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-purple-800">
      Acessar solicitações →
    </span>
  </Link>
</div>
)}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
  {[
  {
    title: "Clientes",
    description: "Cadastro e organização dos clientes.",
    href: "/sistema/clientes",
    permissionModule: "customers",
  },
  {
    title: "Orçamentos",
    description: role === "owner"
      ? "Revise as propostas da equipe e aprove os orçamentos."
      : "Crie propostas para a organização enviar ao proprietário para aprovação.",
    href: "/sistema/orcamentos",
    permissionModule: "quotes",
  },
  {
    title: "Agenda",
    description: role === "owner"
      ? "Agende atendimentos e atribua à sua equipe."
      : "Consulte e atualize os atendimentos atribuídos a você.",
    href: "/sistema/agenda",
    permissionModule: "agenda",
  },
  {
    title: "Serviços",
    description: "Catálogo de serviços e valores.",
    href: "/sistema/servicos",
    permissionModule: "services",
  },
  {
    title: "Financeiro",
    description: "Controle de receitas e despesas.",
    href: "/sistema/financeiro",
    permissionModule: "finance",
  },
  {
    title: "Configurações",
    description: "Dados do profissional e do negócio.",
    href: "/sistema/configuracoes",
    permissionModule: null,
  },
].filter((item) => role === "owner" || Boolean(item.permissionModule && modulePermissions[item.permissionModule as keyof MemberPermissions].view)).map((item) => item.href ? (
  <Link key={item.title} href={item.href} className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition duration-150 hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2">
    <h3 className="text-lg font-semibold text-slate-900">
      {item.title}
    </h3>

    <p className="mt-2 text-sm leading-6 text-slate-600">
      {item.description}
    </p>

    <span className="mt-5 inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-purple-800">Acessar módulo <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span></span>
  </Link>
) : (
  <article key={item.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
    <span className="mt-4 inline-block text-xs font-medium text-slate-500">Em breve</span>
  </article>
))}
  <Link
    href="/sistema/suporte"
    className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition duration-150 hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
  >
    <h3 className="text-lg font-semibold text-slate-900">Suporte VALLEX</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">Peça ajuda com sua conta, plano ou qualquer ferramenta do ServiçoFácil.</p>
    <span className="mt-5 inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-purple-800">Abrir suporte <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span></span>
  </Link>
{role === "owner" && (
  <Link
    href="/sistema/vitrine"
    className="group rounded-xl border border-purple-200 bg-white p-6 shadow-sm transition duration-150 hover:-translate-y-1 hover:border-violet-400 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
  >
    <h3 className="text-lg font-semibold text-slate-900">
      Vitrine pública
    </h3>

    <p className="mt-2 text-sm leading-6 text-slate-600">
      Configure e publique sua apresentação no ServiçoFácil.
    </p>

    <span className="mt-5 inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-purple-800">
      Configurar Vitrine <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
    </span>
  </Link>
)}

  {role === "owner" && (
    <Link
href="/sistema/planos"
    className="group rounded-xl border border-purple-200 bg-white p-6 shadow-sm transition duration-150 hover:-translate-y-1 hover:border-violet-400 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
    >
      <h3 className="text-lg font-semibold text-slate-900">Planos e assinatura</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">Consulte seu plano e conheça as opções de assinatura mensal.</p>
      <span className="mt-5 inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-purple-800">
        Ver planos <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </Link>
  )}

  {role === "owner" && (
    <Link
      href="/sistema/equipe"
      className="group rounded-xl border border-purple-200 bg-white p-6 shadow-sm transition duration-150 hover:-translate-y-1 hover:border-violet-400 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
    >
      <h3 className="text-lg font-semibold text-slate-900">
        Equipe
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        Gerencie colaboradores, convites e acessos da organização.
      </p>

      <span className="mt-5 inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-purple-800">
        Gerenciar equipe <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
      </span>
    </Link>
  )}
</div>
      </section>
    </main>
  );
}

