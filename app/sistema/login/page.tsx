"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              organization_name: organizationName.trim(),
              business_type: businessType.trim(),
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          router.replace("/sistema");
          return;
        }

        setMode("login");
        setMessage(
          "Conta criada. Confirme seu e-mail e depois entre para concluir o cadastro do seu negócio."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) throw error;

        const requestedDestination = new URLSearchParams(
          window.location.search
        ).get("next");
        const destination =
          requestedDestination === "/sistema/planos"
            ? requestedDestination
            : "/sistema";

        window.location.replace(destination);
        return;
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a operação."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <Link
          href="/"
          aria-label="Voltar à página inicial da VALLEX"
          title="Página inicial da VALLEX"
          className="mb-6 inline-flex size-11 items-center justify-center rounded-lg border border-violet-200 text-violet-700 shadow-sm transition hover:border-violet-400 hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="size-5"
          >
            <path
              d="m3.5 10.5 8.5-7 8.5 7v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-9Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path
              d="M9 20.5v-7h6v7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-[0.25em] text-violet-700">
            VALLEX
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            ServiçoFácil
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Acesso à plataforma de gestão
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setMessage("");
            }}
            aria-pressed={mode === "login"}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "login"
                ? "bg-white text-violet-700 shadow ring-1 ring-violet-200"
                : "text-slate-600 hover:bg-white/80 hover:text-violet-700 hover:shadow-sm"
            } transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600`}
          >
            Entrar
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setMessage("");
            }}
            aria-pressed={mode === "signup"}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              mode === "signup"
                ? "bg-white text-violet-700 shadow ring-1 ring-violet-200"
                : "text-slate-600 hover:bg-white/80 hover:text-violet-700 hover:shadow-sm"
            } transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600`}
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div>
                <label
                  htmlFor="organizationName"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Nome do prestador ou da empresa
                </label>
                <input
                  id="organizationName"
                  type="text"
                  autoComplete="organization"
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
                  htmlFor="businessType"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Atividade principal
                </label>
                <input
                  id="businessType"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={businessType}
                  onChange={(event) => setBusinessType(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
                  placeholder="Ex.: serviços elétricos, informática"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
              placeholder="Mínimo de 6 caracteres"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-700 px-4 py-3 font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Aguarde..."
              : mode === "login"
                ? "Entrar"
                : "Criar minha conta"}
          </button>
        </form>

        {message && (
          <p
            role="status"
            className="mt-5 rounded-lg bg-slate-100 p-3 text-sm text-slate-700"
          >
            {message}
          </p>
        )}

      </section>
    </main>
  );
}

