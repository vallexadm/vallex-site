"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AceitarConvitePage() {
  const router = useRouter();

  const [invitationToken, setInvitationToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const tokenFromLink = params.get("token") ?? "";
      const emailFromLink = params.get("email") ?? "";

      if (/^[a-f0-9]{64}$/i.test(tokenFromLink)) setInvitationToken(tokenFromLink);
      if (emailFromLink.includes("@")) setInvitedEmail(emailFromLink);

      void supabase.auth.getSession().then(({ data }) => {
        setAccountEmail(data.session?.user.email ?? "");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function loginUrl() {
    const next = `${window.location.pathname}${window.location.search}`;
    return `/sistema/login?next=${encodeURIComponent(next)}`;
  }

  async function switchAccount() {
    await supabase.auth.signOut();
    router.replace(loginUrl());
  }

  async function acceptWithToken(accessToken: string, rawToken = invitationToken) {
    setError("");
    setMessage("");

    const token = rawToken.trim();

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      setError("Informe um token de convite válido.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/sistema/convites/aceitar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ invitationToken: token }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(result.message ?? "Não foi possível aceitar o convite.");
        return;
      }

      setAccepted(true);
      setMessage(
        `Convite aceito! Você agora faz parte da organização ${result.organization.name}.`
      );
      setInvitationToken("");
    } catch {
      setError("Erro de comunicação ao aceitar o convite.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("Entre ou crie uma conta para aceitar este convite.");
      return;
    }

    await acceptWithToken(session.access_token);
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedEmail = invitedEmail.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Informe o e-mail convidado e crie uma senha.");
      return;
    }

    setCreatingAccount(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (signUpError) throw signUpError;

      if (data.session?.access_token) {
        setAccountEmail(data.user?.email ?? normalizedEmail);
        await acceptWithToken(data.session.access_token);
        return;
      }

      setMessage("Conta criada. Confirme o e-mail enviado pelo sistema e depois entre por este mesmo link para concluir a entrada na equipe.");
    } catch (signUpError) {
      setError(signUpError instanceof Error ? signUpError.message : "Não foi possível criar a conta.");
    } finally {
      setCreatingAccount(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium tracking-[0.2em] text-purple-700">
          VALLEX
        </p>

        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Aceitar convite
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Abra o link compartilhado pelo proprietário. Se ainda não tiver conta, crie uma com o e-mail convidado; o convite será aceito em seguida.
        </p>

        {invitedEmail && (
          <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-950">
            Convite destinado a <strong>{invitedEmail}</strong>.
          </div>
        )}

        {accountEmail ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Conta conectada: <strong>{accountEmail}</strong>
            {invitedEmail && accountEmail.toLowerCase() !== invitedEmail.toLowerCase() && (
              <p className="mt-1 text-amber-800">Esta conta é diferente do e-mail convidado. Troque de conta antes de aceitar.</p>
            )}
            <button type="button" onClick={() => void switchAccount()} className="mt-2 block font-medium text-purple-800 underline">
              Trocar de conta
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => router.push(loginUrl())} className="mt-4 text-sm font-medium text-purple-800 underline">
            Entrar com o e-mail convidado
          </button>
        )}

        {message && (
          <div className="mt-5 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!accepted ? (
          <>
          {!accountEmail && invitedEmail && (
            <form onSubmit={handleCreateAccount} className="mt-6 space-y-3 rounded-lg border border-purple-100 bg-purple-50 p-4">
              <h2 className="font-semibold text-slate-900">Primeiro acesso? Crie sua conta de colaborador</h2>
              <label htmlFor="invite-signup-email" className="block text-sm font-medium text-slate-700">E-mail convidado</label>
              <input id="invite-signup-email" type="email" readOnly value={invitedEmail} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700" />
              <label htmlFor="invite-signup-password" className="block text-sm font-medium text-slate-700">Crie uma senha</label>
              <input id="invite-signup-password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" placeholder="Mínimo de 6 caracteres" />
              <button type="submit" disabled={creatingAccount || loading} className="w-full rounded-lg bg-purple-700 px-4 py-3 font-medium text-white hover:bg-purple-800 disabled:opacity-60">
                {creatingAccount ? "Criando conta..." : "Criar conta e entrar na equipe"}
              </button>
            </form>
          )}
          <form onSubmit={handleAccept} className="mt-6 space-y-4">
            {!invitationToken && <div>
              <label
                htmlFor="invitationToken"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Token do convite
              </label>

              <textarea
                id="invitationToken"
                value={invitationToken}
                onChange={(event) => setInvitationToken(event.target.value)}
                rows={3}
                required
                maxLength={64}
                placeholder="Cole aqui o token de 64 caracteres"
                className="w-full rounded-lg border border-slate-300 px-3 py-3 font-mono text-sm text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              />
            </div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-purple-700 px-4 py-3 font-medium text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Validando convite..." : invitationToken ? "Aceitar convite" : "Validar token"}
            </button>
          </form>
          </>
        ) : (
          <button
            type="button"
            onClick={() => router.replace("/sistema")}
            className="mt-6 w-full rounded-lg bg-purple-700 px-4 py-3 font-medium text-white transition hover:bg-purple-800"
          >
            Acessar painel
          </button>
        )}
      </section>
    </main>
  );
}
