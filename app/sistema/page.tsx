"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function SistemaPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.replace("/sistema/login");
        return;
      }

      setEmail(data.user.email ?? "");
      setChecking(false);
    }

    checkSession();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/sistema/login");
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Verificando acesso...
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
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Clientes",
              description: "Cadastro e organização dos clientes.",
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
              <span className="mt-4 inline-block text-xs font-medium text-purple-700">
                Módulo planejado
              </span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}