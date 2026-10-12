"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function SistemaPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(true);
  const [organizationName, setOrganizationName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [role, setRole] = useState("");
  const [contextError, setContextError] = useState("");
  const [needsOrganization, setNeedsOrganization] = useState(false);
  const [savingOrganization, setSavingOrganization] = useState(false);

  useEffect(() => {
    async function checkSession() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    router.replace("/sistema/login");
    return;
  }

  setEmail(data.user.email ?? "");
  const metadata = data.user.user_metadata ?? {};
  setOrganizationName(
    typeof metadata.organization_name === "string"
      ? metadata.organization_name
      : ""
  );
  setBusinessType(
    typeof metadata.business_type === "string" ? metadata.business_type : ""
  );

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    setContextError("Não foi possível obter a sessão autenticada.");
    setChecking(false);
    return;
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

    setOrganizationName(result.organization.name);
    setRole(result.role);
  } catch {
    setContextError("Erro ao consultar os dados da organização.");
  }

  setChecking(false);
}

    checkSession();
  }, [router]);

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

      setOrganizationName(result.organization.name);
      setBusinessType(result.organization.business_type ?? businessType);
      setRole("owner");
      setNeedsOrganization(false);
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
        <header className="bg-[#17002E] px-6 py-5 text-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div>
              <p className="text-sm tracking-[0.2em] text-purple-300">VALLEX</p>
              <h1 className="text-xl font-bold">ServiçoFácil</h1>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-purple-300 px-4 py-2 text-sm hover:bg-purple-900"
            >
              Sair
            </button>
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
              Sua área começa no plano Free. A Vitrine será criada como não
              publicada; você decide quando torná-la pública.
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
      <header className="bg-[#17002E] px-6 py-5 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-sm tracking-[0.2em] text-purple-300">
              VALLEX
            </p>
            <h1 className="text-xl font-bold">ServiçoFácil</h1>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg border border-purple-300 px-4 py-2 text-sm hover:bg-purple-900"
          >
            Sair
          </button>
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
        <div className="mt-6">
  <Link
    href="/sistema/solicitacoes"
    className="flex flex-col gap-2 rounded-xl border border-purple-200 bg-white p-6 shadow-sm transition hover:border-purple-400 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
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

    <span className="inline-flex w-fit items-center rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white">
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
  },
  {
    title: "Orçamentos",
    description: "Registro e acompanhamento de propostas.",
  },
  {
    title: "Agenda",
    description: "Agendamento de visitas e atendimentos.",
  },
  {
    title: "Serviços",
    description: "Catálogo de serviços e valores.",
  },
  {
    title: "Financeiro",
    description: "Controle de receitas e despesas.",
  },
  {
    title: "Configurações",
    description: "Dados do profissional e do negócio.",
  },
].map((item) => (
  <article
    key={item.title}
    className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
  >
    <h3 className="text-lg font-semibold text-slate-900">
      {item.title}
    </h3>

    <p className="mt-2 text-sm leading-6 text-slate-600">
      {item.description}
    </p>

    {item.href ? (
      <Link
        href={item.href}
        className="mt-4 inline-flex items-center rounded-lg bg-purple-700 px-4 py-2 text-xs font-medium text-white transition hover:bg-purple-800"
      >
        Acessar módulo →
      </Link>
    ) : (
      <span className="mt-4 inline-block text-xs font-medium text-purple-700">
        Módulo planejado
      </span>
    )}
  </article>
))}
{role === "owner" && (
  <Link
    href="/sistema/vitrine"
    className="rounded-xl border border-purple-200 bg-white p-6 shadow-sm transition hover:border-purple-400 hover:shadow-md"
  >
    <h3 className="text-lg font-semibold text-slate-900">
      Vitrine pública
    </h3>

    <p className="mt-2 text-sm leading-6 text-slate-600">
      Configure e publique sua apresentação no ServiçoFácil.
    </p>

    <span className="mt-4 inline-block text-xs font-medium text-purple-700">
      Configurar Vitrine →
    </span>
  </Link>
)}

  {role === "owner" && (
    <Link
      href="/sistema/equipe"
      className="rounded-xl border border-purple-200 bg-white p-6 shadow-sm transition hover:border-purple-400 hover:shadow-md"
    >
      <h3 className="text-lg font-semibold text-slate-900">
        Equipe
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        Gerencie colaboradores, convites e acessos da organização.
      </p>

      <span className="mt-4 inline-block text-xs font-medium text-purple-700">
        Gerenciar equipe →
      </span>
    </Link>
  )}
</div>
      </section>
    </main>
  );
}
