"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import ActionNotice from "@/components/ActionNotice";
import PasswordInput from "@/components/PasswordInput";
import { endCurrentSession } from "@/lib/end-current-session";
import { supabase } from "@/lib/supabase/client";

const field = "mt-2 block w-full rounded-lg border border-slate-300 px-3 py-3";
const primary = "w-full rounded-lg bg-purple-700 px-4 py-3 font-semibold text-white disabled:opacity-60";
const secondary = "rounded-lg border border-purple-200 px-4 py-2 font-semibold text-purple-800";
type Stage = "loading" | "login" | "signup" | "recover" | "code" | "complete" | "reset" | "account";

export default function CustomerAccess() {
  const [stage, setStage] = useState<Stage>("loading");
  const [recovering, setRecovering] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const user = data.user;
      if (!user?.phone || !user.phone_confirmed_at) {
        setStage("login");
        return;
      }
      setName(typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "");
      setEmail(typeof user.user_metadata.contact_email === "string" ? user.user_metadata.contact_email : "");
      setStage(user.user_metadata.customer_registration_complete === true ? "account" : "complete");
    }).catch(() => { if (active) setStage("login"); });
    return () => { active = false; };
  }, []);

  function open(next: Stage) {
    setError("");
    setNotice("");
    setPassword("");
    setCode("");
    setStage(next);
  }

  async function finishRegistration() {
    if (name.trim().length < 2 || !email.trim() || password.length < 8) {
      setStage("complete");
      return;
    }
    const { error } = await supabase.auth.updateUser({
      password,
      data: { full_name: name.trim(), contact_email: email.trim(), customer_registration_complete: true },
    });
    if (error) {
      setStage("complete");
      throw new Error("Não foi possível concluir o cadastro. Confira os dados e tente novamente.");
    }
    open("account");
    setNotice("Cadastro concluído. Seu celular foi confirmado.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (stage === "complete") {
        await finishRegistration();
        return;
      }
      if (stage === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error("Não foi possível salvar a nova senha. Tente outra senha.");
        await endCurrentSession(supabase.auth);
        open("login");
        setNotice("Senha atualizada. Entre com seu celular e a nova senha.");
        return;
      }
      const number = "+55" + phone;
      if (!/^[1-9][0-9]9[0-9]{8}$/.test(phone)) {
        throw new Error("Informe um celular brasileiro com DDD e 11 dígitos.");
      }
      if (stage === "login") {
        const result = await supabase.auth.signInWithPassword({ phone: number, password });
        if (result.error || !result.data.user?.phone_confirmed_at) {
          throw new Error("Não foi possível entrar. Confira o celular e a senha ou use Esqueci minha senha.");
        }
        const profile = result.data.user.user_metadata;
        setName(typeof profile.full_name === "string" ? profile.full_name : "");
        setEmail(typeof profile.contact_email === "string" ? profile.contact_email : "");
        open(profile.customer_registration_complete === true ? "account" : "complete");
      } else if (stage === "code") {
        const result = await supabase.auth.verifyOtp({ phone: number, token: code, type: "sms" });
        if (result.error || !result.data.user?.phone_confirmed_at || !result.data.session) {
          throw new Error("Não foi possível validar o código. Confira os seis dígitos ou solicite outro.");
        }
        if (recovering) open("reset");
        else await finishRegistration();
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          phone: number,
          options: { shouldCreateUser: stage === "signup" },
        });
        if (error) {
          throw new Error(error.code === "phone_provider_disabled"
            ? "O acesso por SMS ainda não está disponível neste ambiente."
            : "Não foi possível enviar o código. Confira o celular e tente novamente em instantes.");
        }
        setRecovering(stage === "recover");
        setStage("code");
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível concluir agora.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await endCurrentSession(supabase.auth);
      setName("");
      setEmail("");
      setPhone("");
      open("login");
    } catch {
      setError("Não foi possível sair. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const registration = stage === "signup" || stage === "complete";
  const passwordField = registration || stage === "login" || stage === "reset";
  const labels: Partial<Record<Stage, string>> = {
    login: "Entrar",
    signup: "Enviar código por SMS",
    recover: "Enviar código de recuperação",
    code: "Confirmar celular",
    complete: "Concluir cadastro",
    reset: "Salvar nova senha",
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <section className="mx-auto max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Área do cliente</h1>
        {stage === "loading" ? <p className="mt-4">Carregando…</p> : stage === "account" ? (
          <div className="mt-4 space-y-4">
            <p>Olá, <strong>{name}</strong>.</p>
            <p className="break-words text-sm text-slate-600">E-mail de contato: {email}</p>
            <button type="button" disabled={busy} onClick={() => void signOut()} className={secondary}>Sair</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            {registration && <label className="block font-medium">Nome
              <input className={field} autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} />
            </label>}
            {["signup", "login", "recover"].includes(stage) && <label className="block font-medium">Celular com DDD
              <input className={field} type="tel" inputMode="numeric" autoComplete="tel-national" required pattern="[0-9]{11}" value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))} />
            </label>}
            {registration && <label className="block font-medium">E-mail de contato
              <input className={field} type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
            </label>}
            {passwordField && <div>
              <label htmlFor="customer-password" className="block font-medium">{stage === "login" ? "Senha" : stage === "reset" ? "Nova senha" : "Criar senha"}</label>
              <PasswordInput id="customer-password" className={field} required minLength={stage === "login" ? undefined : 8} maxLength={72} autoComplete={stage === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} />
              {stage !== "login" && <p className="mt-1 text-xs text-slate-600">Use pelo menos 8 caracteres.</p>}
            </div>}
            {stage === "code" && <label className="block font-medium">Código de confirmação
              <span className="mt-1 block text-sm font-normal text-slate-600">Digite os seis dígitos do SMS enviado ao celular informado.</span>
              <input className={field} inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} />
            </label>}
            <button disabled={busy} className={primary}>{busy ? "Aguarde…" : labels[stage]}</button>
            {stage === "login" ? <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} className={secondary} onClick={() => open("signup")}>Criar conta</button>
              <button type="button" disabled={busy} className={secondary} onClick={() => open("recover")}>Esqueci minha senha</button>
            </div> : stage === "complete" || stage === "reset" ? (
              <button type="button" disabled={busy} className={secondary} onClick={() => void signOut()}>Sair</button>
            ) : <button type="button" disabled={busy} className={secondary} onClick={() => open("login")}>Voltar ao acesso</button>}
          </form>
        )}
        {error && <ActionNotice inline error message={error} onClose={() => setError("")} />}
        {notice && <ActionNotice inline message={notice} onClose={() => setNotice("")} />}
        <Link href="/app" className="mt-5 inline-block font-semibold text-purple-700">Buscar prestadores e serviços →</Link>
      </section>
    </main>
  );
}
