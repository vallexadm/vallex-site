"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AceitarConvitePage() {
  const router = useRouter();

  const [invitationToken, setInvitationToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function handleAccept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    const token = invitationToken.trim();

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      setError("Informe um token de convite válido.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;

      if (!accessToken) {
        setError(
          "Faça login com a conta de e-mail que recebeu o convite e tente novamente."
        );
        return;
      }

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
          Entre com a conta de e-mail convidada e informe o token recebido do
          proprietário da organização.
        </p>

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
          <form onSubmit={handleAccept} className="mt-6 space-y-4">
            <div>
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-purple-700 px-4 py-3 font-medium text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Validando convite..." : "Aceitar convite"}
            </button>
          </form>
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