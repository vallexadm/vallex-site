"use client";
import { endCurrentSession } from "@/lib/end-current-session";
import PasswordInput from "@/components/PasswordInput";

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
  const [acceptedContext, setAcceptedContext] = useState<{ userId: string; organizationId: string } | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [awaitingEmailConfirmation, setAwaitingEmailConfirmation] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const authHash = new URLSearchParams(window.location.hash.slice(1));
      const authError = authHash.get("error") || params.get("error");
      if (authError) {
        setError("Não foi possível validar o link de acesso. Ele pode ter expirado ou já ter sido utilizado. Solicite um novo e-mail ao proprietário e abra somente o mais recente. Se já possui senha, entre na sua conta para aceitar o convite ainda vigente.");
        // Remove a falha da URL, preservando os parâmetros do convite.
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      }

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

  async function openCollaboratorPanel() {
    setError(""); setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!user || !session || user.id !== acceptedContext?.userId) throw new Error("A conta conectada mudou. Entre novamente com o e-mail do colaborador.");
      const response = await fetch("/api/sistema/organizacao", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível verificar seu vínculo.");
      if (result.role !== "member" || result.organization.id !== acceptedContext.organizationId) throw new Error("O painel retornou outro perfil ou organização. O acesso foi interrompido para preservar o vínculo de colaborador.");
      router.replace("/sistema"); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível abrir o painel."); }
    finally { setLoading(false); }
  }

  function loginUrl() {
    const next = `${window.location.pathname}${window.location.search}`;
    return `/sistema/login?next=${encodeURIComponent(next)}`;
  }

  async function switchAccount() {
    try { await endCurrentSession(supabase.auth); window.location.replace(loginUrl()); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível trocar de conta."); }
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

      setAcceptedContext({ userId: result.userId, organizationId: result.organization.id });
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

  async function continueAfterConfirmation() {
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push(loginUrl());
      return;
    }
    if (session.user.email?.toLowerCase() !== invitedEmail.trim().toLowerCase()) {
      setError("Entre com o e-mail convidado para continuar como colaborador.");
      return;
    }
    setAccountEmail(session.user.email ?? "");
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
        options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}`, data: {
          terms_version: "2026-10-17-v2",
          privacy_notice_version: "2026-10-17-v2",
          terms_accepted_at: new Date().toISOString(),
          privacy_notice_accepted_at: new Date().toISOString(),
        } },
      });

      if (signUpError) throw signUpError;

      if (data.session?.access_token) {
        setAccountEmail(data.user?.email ?? normalizedEmail);
        await acceptWithToken(data.session.access_token);
        return;
      }

      setAwaitingEmailConfirmation(true);
      setPassword("");
      setMessage("Conta criada. Confirme seu e-mail e clique em Já confirmei meu e-mail — continuar. Se necessário, entraremos na sua conta antes de concluir o aceite da equipe.");
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
          {awaitingEmailConfirmation && (
            <button type="button" disabled={loading} onClick={() => void continueAfterConfirmation()} className="mt-4 w-full rounded-lg bg-purple-700 px-4 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-60">Já confirmei meu e-mail — continuar</button>
          )}
          {!accountEmail && invitedEmail && !awaitingEmailConfirmation && (
            <form onSubmit={handleCreateAccount} className="mt-6 space-y-3 rounded-lg border border-purple-100 bg-purple-50 p-4">
              <h2 className="font-semibold text-slate-900">Primeiro acesso? Crie sua conta de colaborador</h2>
              <label htmlFor="invite-signup-email" className="block text-sm font-medium text-slate-700">E-mail convidado</label>
              <input id="invite-signup-email" type="email" readOnly value={invitedEmail} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700" />
              <label htmlFor="invite-signup-password" className="block text-sm font-medium text-slate-700">Crie uma senha</label>
              <PasswordInput id="invite-signup-password"  autoComplete="new-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" placeholder="Mínimo de 6 caracteres" />
              <label className="flex items-start gap-2 text-sm leading-5 text-slate-600">
                <input type="checkbox" required checked={acceptedLegal} onChange={(event) => setAcceptedLegal(event.target.checked)} className="mt-1 accent-violet-700" />
                <span>Tenho 18 anos ou mais, li e aceito os <a className="font-semibold text-violet-700 underline" href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a> e li a <a className="font-semibold text-violet-700 underline" href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.</span>
              </label>
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
              disabled={loading || !accountEmail}
              className="w-full rounded-lg bg-purple-700 px-4 py-3 font-medium text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Validando convite..." : invitationToken ? "Aceitar convite" : "Validar token"}
            </button>
          </form>
          </>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={() => void openCollaboratorPanel()}
            className="mt-6 w-full rounded-lg bg-purple-700 px-4 py-3 font-medium text-white transition hover:bg-purple-800"
          >
            Acessar painel do colaborador
          </button>
        )}
      </section>
    </main>
  );
}
