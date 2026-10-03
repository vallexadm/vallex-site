"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Member = {
  id: string;
  user_id: string;
  email: string | null;
  role: string;
  created_at: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
};

type TeamData = {
  organization: {
    id: string;
    name: string;
  };
  members: Member[];
  invitations: Invitation[];
};

export default function EquipePage() {
  const router = useRouter();

  const [team, setTeam] = useState<TeamData | null>(null);
  const [email, setEmail] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const getAccessToken = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !data.session?.access_token) {
      router.replace("/sistema/login");
      return null;
    }

    return data.session.access_token;
  }, [router]);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) return;

      const response = await fetch("/api/sistema/equipe", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (response.status === 403) {
        setError("A gestão da equipe está disponível somente para o proprietário.");
        setTeam(null);
        return;
      }

      if (!response.ok || !result.ok) {
        setError(result.message ?? "Não foi possível carregar a equipe.");
        return;
      }

      setTeam({
        organization: result.organization,
        members: result.members ?? [],
        invitations: result.invitations ?? [],
      });
    } catch {
      setError("Erro de comunicação ao carregar a equipe.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");
    setInvitationToken("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Informe o e-mail do colaborador.");
      return;
    }

    setSending(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) return;

      const response = await fetch("/api/sistema/convites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(result.message ?? "Não foi possível criar o convite.");
        return;
      }

      setMessage(result.message ?? "Convite criado com sucesso.");
      setInvitationToken(result.invitationToken ?? "");
      setEmail("");

      await loadTeam();
    } catch {
      setError("Erro de comunicação ao criar o convite.");
    } finally {
      setSending(false);
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        Carregando equipe...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-[#17002E] px-6 py-5 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-sm tracking-[0.2em] text-purple-300">VALLEX</p>
            <h1 className="text-xl font-bold">ServiçoFácil</h1>
          </div>

          <Link
            href="/sistema"
            className="rounded-lg border border-purple-300 px-4 py-2 text-sm hover:bg-purple-900"
          >
            Voltar ao painel
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-slate-500">Gestão da organização</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">
          Equipe
        </h2>

        <p className="mt-2 text-slate-600">
          Gerencie os acessos dos colaboradores da sua organização.
        </p>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {team && (
          <>
            <div className="mt-6 rounded-xl border border-purple-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">Organização</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">
                {team.organization.name}
              </h3>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">
                  Convidar colaborador
                </h3>

                <p className="mt-2 text-sm text-slate-600">
                  Informe o e-mail que será associado ao convite.
                </p>

                <form onSubmit={handleInvite} className="mt-5 space-y-4">
                  <div>
                    <label
                      htmlFor="invite-email"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      E-mail do colaborador
                    </label>

                    <input
                      id="invite-email"
                      type="email"
                      required
                      maxLength={320}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="nome@exemplo.com"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    className="rounded-lg bg-purple-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? "Criando convite..." : "Criar convite"}
                  </button>
                </form>
                {invitationToken && (
  <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-4">
    <h3 className="font-semibold text-green-900">
      Convite criado — copie o token
    </h3>

    <p className="mt-2 break-all rounded bg-white p-3 font-mono text-sm text-slate-800">
      {invitationToken}
    </p>

    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(invitationToken);
      }}
      className="mt-3 rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
    >
      Copiar token
    </button>

    <p className="mt-2 text-xs text-green-800">
      Guarde este token. Ele será necessário para aceitar o convite.
    </p>
  </div>
)}

                {message && (
                  <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    {message}
                  </p>
                )}

                {invitationToken && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h4 className="font-semibold text-amber-900">
                      Token do convite
                    </h4>

                    <p className="mt-1 text-sm text-amber-800">
                      Copie e guarde este token. Ele não será exibido novamente
                      após sair desta tela ou atualizar a página.
                    </p>

                    <textarea
                      readOnly
                      value={invitationToken}
                      rows={3}
                      className="mt-3 w-full break-all rounded-md border border-amber-300 bg-white p-3 text-sm text-slate-800"
                      onFocus={(event) => event.currentTarget.select()}
                      aria-label="Token do convite"
                    />

                    <p className="mt-2 text-xs text-amber-800">
                      A página de aceitação do convite será integrada na próxima
                      etapa. Por enquanto, este é apenas o token gerado.
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">
                  Resumo da equipe
                </h3>

                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <p>
                    <strong>Membros cadastrados:</strong>{" "}
                    {team.members.length}
                  </p>
                  <p>
                    <strong>Convites pendentes:</strong>{" "}
                    {team.invitations.length}
                  </p>
                </div>

                <p className="mt-4 text-xs leading-5 text-slate-500">
                  O limite de usuários por plano será exibido aqui quando
                  integrarmos os dados da assinatura à API da equipe.
                </p>
              </section>
            </div>

            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Membros da organização
              </h3>

              {team.members.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">
                  Nenhum membro adicional foi cadastrado.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-3 py-3 font-medium">E-mail do usuário</th>
                        <th className="px-3 py-3 font-medium">Perfil</th>
                        <th className="px-3 py-3 font-medium">Desde</th>
                      </tr>
                    </thead>

                    <tbody>
                      {team.members.map((member) => (
                        <tr key={member.id} className="border-b border-slate-100">
                          <td className="break-all px-3 py-3 text-slate-700">
                            {member.email ?? "E-mail não disponível"}
                            </td>
                          <td className="px-3 py-3 text-slate-700">
                            {member.role === "owner"
                              ? "Proprietário"
                              : "Colaborador"}
                          </td>
                          <td className="px-3 py-3 text-slate-700">
                            {formatDate(member.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Convites pendentes
              </h3>

              {team.invitations.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">
                  Não há convites pendentes.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-3 py-3 font-medium">E-mail</th>
                        <th className="px-3 py-3 font-medium">Perfil</th>
                        <th className="px-3 py-3 font-medium">Criado em</th>
                        <th className="px-3 py-3 font-medium">Expira em</th>
                      </tr>
                    </thead>

                    <tbody>
                      {team.invitations.map((invitation) => (
                        <tr
                          key={invitation.id}
                          className="border-b border-slate-100"
                        >
                          <td className="px-3 py-3 text-slate-700">
                            {invitation.email}
                          </td>
                          <td className="px-3 py-3 text-slate-700">
                            Colaborador
                          </td>
                          <td className="px-3 py-3 text-slate-700">
                            {formatDate(invitation.created_at)}
                          </td>
                          <td className="px-3 py-3 text-slate-700">
                            {formatDate(invitation.expires_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}