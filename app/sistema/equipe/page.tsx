"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SystemBrand from "@/components/SystemBrand";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Member = {
  id: string;
  user_id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
};

type Invitation = {
  id: string;
  email: string;
  invitee_name: string | null;
  contact_phone: string | null;
  role: string;
  status: string;
  invited_by: string | null;
  created_at: string;
  expires_at: string;
};

type ResendLink = {
  url: string;
  message: string;
};

type TeamCapacity = {
  planCode: string;
  planName: string;
  maxUsers: number;
  occupiedSlots: number;
  availableSlots: number;
};

type TeamData = {
  organization: {
    id: string;
    name: string;
  };
  members: Member[];
  invitations: Invitation[];
  teamCapacity: TeamCapacity;
};

export default function EquipePage() {
  const router = useRouter();

  const [team, setTeam] = useState<TeamData | null>(null);
  const [email, setEmail] = useState("");
  const [inviteeName, setInviteeName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const [copiedMessage, setCopiedMessage] = useState("");
  const [fallbackCopy, setFallbackCopy] = useState<{ label: string; value: string } | null>(null);
  const [resendLinks, setResendLinks] = useState<Record<string, ResendLink>>({});
  const [resendingInvitationId, setResendingInvitationId] = useState("");
  const [revokingInvitationId, setRevokingInvitationId] = useState("");
  const [editingMemberId, setEditingMemberId] = useState("");
  const [editingMemberName, setEditingMemberName] = useState("");
  const [editingMemberPhone, setEditingMemberPhone] = useState("");
  const [savingMemberId, setSavingMemberId] = useState("");
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
    try {
      const accessToken = await getAccessToken();

      setError("");

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
        teamCapacity: result.teamCapacity,
      });
    } catch {
      setError("Erro de comunicação ao carregar a equipe.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTeam();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadTeam]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");
    setInvitationToken("");
    setInvitedEmail("");
    setCopiedMessage("");
    setFallbackCopy(null);

    const normalizedEmail = email.trim().toLowerCase();

    const normalizedName = inviteeName.trim();
    const normalizedPhone = contactPhone.trim();
    const phoneDigits = normalizedPhone.replace(/\D/g, "");

    if (!normalizedEmail || normalizedName.length < 2 || normalizedName.length > 120 || phoneDigits.length < 8 || phoneDigits.length > 15) {
      setError("Informe o e-mail, o nome e um telefone de contato válido do colaborador.");
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
        body: JSON.stringify({ email: normalizedEmail, name: normalizedName, phone: normalizedPhone }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(result.message ?? "Não foi possível criar o convite.");
        return;
      }

      setMessage(result.message ?? "Convite criado com sucesso.");
      setInvitationToken(result.invitationToken ?? "");
      setInvitedEmail(normalizedEmail);
      setEmail("");
      setInviteeName("");
      setContactPhone("");

      setLoading(true);
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

  async function copyText(value: string, successMessage: string) {
    setCopiedMessage("");
    setFallbackCopy(null);

    try {
      await navigator.clipboard.writeText(value);
      setCopiedMessage(successMessage);
    } catch {
      setCopiedMessage("Não foi possível copiar automaticamente. Selecione o conteúdo abaixo.");
      setFallbackCopy({
        label: successMessage === "Token copiado." ? "Token para copiar" : "Link para copiar",
        value,
      });
    }
  }

  function getInvitationLink() {
    const link = new URL("/sistema/convites/aceitar", window.location.origin);
    link.searchParams.set("token", invitationToken);
    if (invitedEmail) link.searchParams.set("email", invitedEmail);
    return link.toString();
  }

  async function handleGenerateResendLink(invitation: Invitation) {
    setResendingInvitationId(invitation.id);
    setResendLinks((current) => ({
      ...current,
      [invitation.id]: { url: "", message: "Gerando um novo link..." },
    }));

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch(
        `/api/sistema/convites/${invitation.id}/reenviar`,
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const result = await response.json();

      if (!response.ok || !result.ok || !result.invitationToken) {
        throw new Error(result.message ?? "Não foi possível gerar o link.");
      }

      const link = new URL("/sistema/convites/aceitar", window.location.origin);
      link.searchParams.set("token", result.invitationToken);
      link.searchParams.set("email", invitation.email);

      let linkMessage = "Novo link gerado. O anterior foi invalidado.";
      try {
        await navigator.clipboard.writeText(link.toString());
        linkMessage += " Link copiado.";
      } catch {
        linkMessage += " Copie o link exibido abaixo.";
      }

      setResendLinks((current) => ({
        ...current,
        [invitation.id]: { url: link.toString(), message: linkMessage },
      }));
      setTeam((current) => current ? {
        ...current,
        invitations: current.invitations.map((item) =>
          item.id === invitation.id
            ? { ...item, expires_at: result.invitation.expiresAt }
            : item
        ),
      } : current);
    } catch (resendError) {
      setResendLinks((current) => ({
        ...current,
        [invitation.id]: {
          url: "",
          message: resendError instanceof Error
            ? resendError.message
            : "Não foi possível gerar o link.",
        },
      }));
    } finally {
      setResendingInvitationId("");
    }
  }

  async function copyResendLink(invitationId: string) {
    const link = resendLinks[invitationId]?.url;
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setResendLinks((current) => ({
        ...current,
        [invitationId]: { ...current[invitationId], message: "Link copiado novamente." },
      }));
    } catch {
      setResendLinks((current) => ({
        ...current,
        [invitationId]: { ...current[invitationId], message: "Selecione e copie o link exibido." },
      }));
    }
  }

  async function handleCancelInvitation(invitation: Invitation) {
    const confirmed = window.confirm(
      `Cancelar o convite de ${invitation.invitee_name || invitation.email}? O link atual deixará de funcionar e a vaga será liberada.`
    );
    if (!confirmed) return;

    setError("");
    setMessage("");
    setRevokingInvitationId(invitation.id);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      const response = await fetch(`/api/sistema/convites/${invitation.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Não foi possível cancelar o convite.");
      }
      setMessage(result.message ?? "Convite cancelado e vaga liberada.");
      setResendLinks((current) => {
        const updated = { ...current };
        delete updated[invitation.id];
        return updated;
      });
      setLoading(true);
      await loadTeam();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Não foi possível cancelar o convite.");
    } finally {
      setRevokingInvitationId("");
    }
  }

  function startEditingMember(member: Member) {
    setEditingMemberId(member.user_id);
    setEditingMemberName(member.name ?? "");
    setEditingMemberPhone(member.phone ?? "");
    setError("");
    setMessage("");
  }

  async function saveMemberContact(member: Member) {
    const name = editingMemberName.trim();
    const phone = editingMemberPhone.trim();
    const phoneDigits = phone.replace(/\D/g, "");
    if (name.length < 2 || name.length > 120 || phoneDigits.length < 8 || phoneDigits.length > 15) {
      setError("Informe um nome e um telefone válidos.");
      return;
    }

    setSavingMemberId(member.user_id);
    setError("");
    setMessage("");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      const response = await fetch("/api/sistema/equipe", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: member.user_id, name, phone }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível atualizar o membro.");
      setTeam((current) => current ? {
        ...current,
        members: current.members.map((item) => item.user_id === member.user_id ? { ...item, name, phone } : item),
      } : current);
      setEditingMemberId("");
      setMessage("Nome e telefone do colaborador atualizados.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível atualizar o membro.");
    } finally {
      setSavingMemberId("");
    }
  }

  const limiteDeEquipeAtingido =
    team !== null && team.teamCapacity.availableSlots === 0;

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
            <SystemBrand />
          </div>

          <Link
            href="/sistema"
            className="inline-flex items-center gap-2 rounded-lg border border-purple-300 px-4 py-2 text-sm font-medium transition hover:bg-purple-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#17002E]"
          >
            <span aria-hidden="true">←</span> Voltar ao painel
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

            <div className="mt-6 max-w-3xl">
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">
                  Convidar colaborador
                </h3>

                <p className="mt-2 text-sm text-slate-600">
                  Informe o e-mail, o nome e o telefone de contato do colaborador.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-900" aria-label="Uso das vagas do plano">
                  <span><strong>{team.teamCapacity.planName}</strong></span>
                  <span>{team.teamCapacity.occupiedSlots}/{team.teamCapacity.maxUsers} vagas ocupadas</span>
                  <span>{team.invitations.length} convites pendentes</span>
                  <span>{team.teamCapacity.availableSlots} disponíveis</span>
                </div>

                {limiteDeEquipeAtingido && (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
                    O limite do plano foi atingido. Para adicionar alguém, libere uma vaga ou consulte os planos.
                  </p>
                )}

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

                  <div>
                    <label htmlFor="invite-name" className="mb-2 block text-sm font-medium text-slate-700">Nome do colaborador</label>
                    <input id="invite-name" type="text" required minLength={2} maxLength={120} value={inviteeName} onChange={(event) => setInviteeName(event.target.value)} placeholder="Nome completo" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200" />
                  </div>

                  <div>
                    <label htmlFor="invite-phone" className="mb-2 block text-sm font-medium text-slate-700">Telefone de contato</label>
                    <input id="invite-phone" type="tel" required maxLength={40} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="(00) 00000-0000" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200" />
                  </div>

                  <button
                    type="submit"
                    disabled={sending || limiteDeEquipeAtingido}
                    className="rounded-lg bg-purple-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending
                      ? "Criando convite..."
                      : limiteDeEquipeAtingido
                        ? "Limite do plano atingido"
                        : "Criar convite"}
                  </button>
                </form>
                {invitationToken && (
                  <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-4">
                    <h3 className="font-semibold text-green-900">Convite criado para {invitedEmail}</h3>
                    <label htmlFor="created-invitation-token" className="mt-3 block text-sm font-medium text-green-900">Token do convite</label>
                    <textarea
                      id="created-invitation-token"
                      readOnly
                      value={invitationToken}
                      rows={2}
                      className="mt-2 w-full break-all rounded-md border border-green-200 bg-white p-3 font-mono text-sm text-slate-800"
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyText(invitationToken, "Token copiado.")}
                        className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                      >Copiar token</button>
                      <button
                        type="button"
                        onClick={() => void copyText(getInvitationLink(), "Link do convite copiado.")}
                        className="rounded-lg border border-green-700 px-4 py-2 text-sm font-medium text-green-900 hover:bg-green-100"
                      >Copiar link do convite</button>
                    </div>
                    {copiedMessage && <p className="mt-2 text-sm font-medium text-green-900" role="status" aria-live="polite">{copiedMessage}</p>}
                    {fallbackCopy && (
                      <label className="mt-2 block text-xs font-medium text-green-900">
                        {fallbackCopy.label}
                        <textarea
                          readOnly
                          value={fallbackCopy.value}
                          rows={2}
                          className="mt-1 w-full break-all rounded-md border border-green-200 bg-white p-2 font-mono text-xs text-slate-800"
                          onFocus={(event) => event.currentTarget.select()}
                        />
                      </label>
                    )}
                    <p className="mt-2 text-xs leading-5 text-green-900">
                      Encaminhe o link ao colaborador. Ele deve abrir o link e entrar com a conta {invitedEmail}. O sistema não envia e-mail automaticamente. O link já leva o token; mantenha-o privado.
                    </p>
                  </div>
                )}

                {message && (
                  <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    {message}
                  </p>
                )}

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
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-3 py-3 font-medium">Nome</th>
                        <th className="px-3 py-3 font-medium">Telefone</th>
                        <th className="px-3 py-3 font-medium">E-mail do usuário</th>
                        <th className="px-3 py-3 font-medium">Perfil</th>
                        <th className="px-3 py-3 font-medium">Desde</th>
                        <th className="px-3 py-3 text-right font-medium">Ações</th>
                      </tr>
                    </thead>

                    <tbody>
                      {team.members.map((member) => (
                        <tr key={member.id} className="border-b border-slate-100">
                          <td className="px-3 py-3 text-slate-700">
                            {editingMemberId === member.user_id ? (
                              <input aria-label="Nome do colaborador" required minLength={2} maxLength={120} value={editingMemberName} onChange={(event) => setEditingMemberName(event.target.value)} className="w-44 rounded border border-slate-300 px-2 py-1" />
                            ) : member.name || "Colaborador"}
                          </td>
                          <td className="px-3 py-3 text-slate-700">
                            {editingMemberId === member.user_id ? (
                              <input aria-label="Telefone do colaborador" type="tel" required maxLength={40} value={editingMemberPhone} onChange={(event) => setEditingMemberPhone(event.target.value)} className="w-36 rounded border border-slate-300 px-2 py-1" />
                            ) : member.phone || "—"}
                          </td>
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
                          <td className="px-3 py-3 text-right">
                            {editingMemberId === member.user_id ? (
                              <div className="flex justify-end gap-2">
                                <button type="button" disabled={savingMemberId === member.user_id} onClick={() => void saveMemberContact(member)} className="rounded-lg bg-purple-700 px-3 py-2 text-xs font-medium text-white hover:bg-purple-800 disabled:opacity-60">
                                  {savingMemberId === member.user_id ? "Salvando..." : "Salvar"}
                                </button>
                                <button type="button" disabled={savingMemberId === member.user_id} onClick={() => setEditingMemberId("")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancelar</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => startEditingMember(member)} className="rounded-lg border border-purple-200 px-3 py-2 text-xs font-medium text-purple-800 hover:bg-purple-50">Editar</button>
                            )}
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
                        <th className="px-3 py-3 font-medium">Nome</th>
                        <th className="px-3 py-3 font-medium">Telefone</th>
                        <th className="px-3 py-3 font-medium">E-mail</th>
                        <th className="px-3 py-3 font-medium">Perfil</th>
                        <th className="px-3 py-3 font-medium">Criado em</th>
                        <th className="px-3 py-3 font-medium">Expira em</th>
                        <th className="px-3 py-3 text-right font-medium">Ações</th>
                      </tr>
                    </thead>

                    <tbody>
                      {team.invitations.map((invitation) => (
                        <tr
                          key={invitation.id}
                          className="border-b border-slate-100"
                        >
                          <td className="px-3 py-3 text-slate-700">
                            {invitation.invitee_name || "—"}
                          </td>
                          <td className="px-3 py-3 text-slate-700">{invitation.contact_phone || "—"}</td>
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
                          <td className="px-3 py-3 text-right">
                            <div className="flex min-w-52 flex-col items-end gap-2">
                            <button
                              type="button"
                              disabled={resendingInvitationId === invitation.id || revokingInvitationId === invitation.id}
                              onClick={() => void handleGenerateResendLink(invitation)}
                              className="rounded-lg border border-purple-200 px-3 py-2 text-xs font-medium text-purple-800 hover:bg-purple-50 disabled:opacity-60"
                            >
                              {resendingInvitationId === invitation.id
                                ? "Gerando..."
                                : resendLinks[invitation.id]?.url
                                  ? "Gerar outro link"
                                  : "Gerar link para reenvio"}
                            </button>
                            <button
                              type="button"
                              disabled={resendingInvitationId === invitation.id || revokingInvitationId === invitation.id}
                              onClick={() => void handleCancelInvitation(invitation)}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              {revokingInvitationId === invitation.id ? "Cancelando..." : "Cancelar convite"}
                            </button>
                            {resendLinks[invitation.id] && (
                              <div className="mt-2 min-w-64 text-left">
                                <p className="text-xs text-slate-600" role="status" aria-live="polite">
                                  {resendLinks[invitation.id].message}
                                </p>
                                {resendLinks[invitation.id].url && (
                                  <>
                                    <textarea
                                      readOnly
                                      aria-label={`Link atualizado para ${invitation.email}`}
                                      value={resendLinks[invitation.id].url}
                                      rows={2}
                                      onFocus={(event) => event.currentTarget.select()}
                                      className="mt-1 w-full rounded border border-slate-200 bg-white p-2 text-xs text-slate-700"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => void copyResendLink(invitation.id)}
                                      className="mt-1 text-xs font-medium text-purple-800 underline"
                                    >Copiar link novamente</button>
                                  </>
                                )}
                              </div>
                            )}
                            </div>
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
