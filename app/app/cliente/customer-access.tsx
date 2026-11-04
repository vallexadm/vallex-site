"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import ActionNotice from "@/components/ActionNotice";
import { supabase } from "@/lib/supabase/client";

const field = "mt-2 block w-full rounded-lg border border-slate-300 px-3 py-3";

export default function CustomerAccess() {
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setConfirmed(Boolean(data.user?.phone && data.user.phone_confirmed_at));
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (sentTo) {
        const result = await supabase.auth.verifyOtp({ phone: sentTo, token: code, type: "sms" });
        if (result.error || !result.data.user?.phone_confirmed_at || !result.data.session) {
          setError("Não foi possível validar o código. Confira os seis dígitos ou solicite outro código.");
          return;
        }
        setConfirmed(true);
      } else {
        if (!/^[1-9][0-9]9[0-9]{8}$/.test(phone)) {
          setError("Informe um celular brasileiro com DDD e 11 dígitos.");
          return;
        }
        const number = "+55" + phone;
        const { error: sendError } = await supabase.auth.signInWithOtp({ phone: number });
        if (sendError) {
          setError(sendError.code === "phone_provider_disabled"
            ? "O acesso por SMS ainda não está disponível neste ambiente."
            : "Não foi possível enviar o código. Confira o celular e tente novamente em instantes.");
          return;
        }
        setSentTo(number);
      }
    } catch {
      setError("Não foi possível concluir agora. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <section className="mx-auto max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <Link href="/app" className="text-sm font-semibold text-purple-700">← Voltar à busca</Link>
        <h1 className="mt-4 text-2xl font-bold">Área do cliente</h1>
        {confirmed ? (
          <>
            <p role="status" className="mt-4 rounded-lg bg-green-50 p-4 text-green-800">Celular confirmado. Sua conta está pronta.</p>
            <Link href="/app" className="mt-4 inline-block rounded-lg bg-purple-700 px-4 py-3 font-semibold text-white">Buscar serviços</Link>
          </>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <p className="text-sm text-slate-600">{sentTo ? "Digite o código de seis dígitos enviado para " + sentTo + "." : "Crie sua conta ou entre com um código enviado por SMS."}</p>
            {sentTo ? (
              <label className="block font-medium">Código de confirmação
                <input className={field} inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} />
              </label>
            ) : (
              <label className="block font-medium">Celular com DDD
                <input className={field} type="tel" inputMode="numeric" autoComplete="tel-national" required maxLength={11} value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, ""))} placeholder="62999999999" />
              </label>
            )}
            <button disabled={busy} className="w-full rounded-lg bg-purple-700 px-4 py-3 font-semibold text-white disabled:opacity-60">
              {busy ? "Aguarde…" : sentTo ? "Confirmar celular" : "Enviar código por SMS"}
            </button>
            {sentTo && <button type="button" disabled={busy} className="text-sm font-semibold text-purple-700" onClick={() => { setSentTo(""); setCode(""); setError(""); }}>Alterar número ou solicitar outro código</button>}
            {error && <ActionNotice inline error message={error} onClose={() => setError("")} />}
          </form>
        )}
      </section>
    </main>
  );
}
