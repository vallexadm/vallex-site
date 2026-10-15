"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";

const legalVersion = "2026-10-14-v1";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup" | "recovery" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("redefinir-senha") === "1") {
      void supabase.auth.getSession().then(({ data }) => {
        setMode("reset");
        setMessage(data.session
          ? "Escolha uma nova senha para sua conta."
          : "Abra o link mais recente recebido por e-mail para continuar a redefinição.");
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setMessage("Escolha uma nova senha para sua conta.");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  function getSafeDestination() {
    const requestedDestination = new URLSearchParams(
      window.location.search
    ).get("next");

    if (!requestedDestination || !requestedDestination.startsWith("/")) {
      return "/sistema";
    }

    try {
      const destinationUrl = new URL(requestedDestination, window.location.origin);
      const allowedPaths = ["/sistema/planos", "/sistema/convites/aceitar", "/admin"];

      if (
        destinationUrl.origin !== window.location.origin ||
        !allowedPaths.includes(destinationUrl.pathname)
      ) {
        return "/sistema";
      }

      return `${destinationUrl.pathname}${destinationUrl.search}`;
    } catch {
      return "/sistema";
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (mode === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          { redirectTo: `${window.location.origin}/sistema/login?redefinir-senha=1` }
        );
        if (error) throw error;
        setMessage("Se essa conta puder redefinir a senha, enviaremos um link para o e-mail informado.");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Senha atualizada. Entrando na sua conta...");
        window.location.replace("/sistema");
        return;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              organization_name: organizationName.trim(),
              business_type: businessType.trim(),
              terms_version: legalVersion,
              privacy_notice_version: legalVersion,
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          window.location.replace(getSafeDestination());
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

        const destination = getSafeDestination();
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
          <div style={{ width: "270px", height: "210px" }} className="mx-auto flex items-center justify-center rounded-xl bg-[#17002E] p-3">
            <Image
              src="/vallex-logo.png"
              alt="VALLEX"
              width={240}
              height={194}
              priority
              style={{ width: "240px", height: "194px", objectFit: "contain" }}
            />
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            ServiçoFácil
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Acesso à plataforma de gestão
          </p>
        </div>

        {(mode === "login" || mode === "signup") && <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setAcceptedTerms(false);
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
              setAcceptedTerms(false);
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
        </div>}

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

          {mode !== "reset" && <div>
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
          </div>}

          {(mode === "login" || mode === "signup" || mode === "reset") && <div>
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
          </div>}

          {mode === "signup" && (
            <label className="flex items-start gap-2 text-sm leading-5 text-slate-600">
              <input
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-1 accent-violet-700"
              />
              <span>
                Li e aceito os <Link className="font-semibold text-violet-700 underline underline-offset-2 hover:text-violet-900" href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</Link> e li a{" "}
                <Link className="font-semibold text-violet-700 underline underline-offset-2 hover:text-violet-900" href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</Link>.
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-violet-700 px-4 py-3 font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Aguarde..."
              : mode === "login"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar minha conta"
                  : mode === "recovery"
                    ? "Enviar link de recuperação"
                    : "Salvar nova senha"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link className="underline hover:text-violet-700" href="/faq">Perguntas frequentes</Link>
          {" · "}
          <Link className="underline hover:text-violet-700" href="/termos">Termos de Uso</Link>
          {" · "}
          <Link className="underline hover:text-violet-700" href="/privacidade">Privacidade</Link>
        </p>

        {mode === "login" && (
          <button
            type="button"
            onClick={() => { setMode("recovery"); setMessage(""); }}
            className="mt-4 w-full text-sm font-medium text-violet-700 hover:text-violet-900"
          >
            Esqueci minha senha
          </button>
        )}
        {(mode === "recovery" || mode === "reset") && (
          <button
            type="button"
            onClick={() => { setMode("login"); setPassword(""); setMessage(""); window.history.replaceState({}, "", "/sistema/login"); }}
            className="mt-4 w-full text-sm font-medium text-violet-700 hover:text-violet-900"
          >
            Voltar para entrar
          </button>
        )}

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

