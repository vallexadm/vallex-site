"use client";
import PasswordInput from "@/components/PasswordInput";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function CadastroEquipePage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const invitedEmail = new URLSearchParams(window.location.search).get("email");
    if (invitedEmail) window.setTimeout(() => setEmail(invitedEmail.trim().toLowerCase()), 0);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: {
          terms_version: "2026-10-17-v2",
          privacy_notice_version: "2026-10-17-v2",
          terms_accepted_at: new Date().toISOString(),
          privacy_notice_accepted_at: new Date().toISOString(),
        } },
      });
      if (signUpError) throw signUpError;
      setMessage(data.session
        ? "Conta criada. O administrador da VALLEX precisa verificar o vínculo e ativar seu acesso. Seu cargo e suas permissões são definidos no painel da equipe."
        : "Conta criada. Confirme o e-mail enviado pelo sistema. Depois, o administrador da VALLEX verificará o vínculo e ativará seu acesso.");
      setPassword("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível criar sua conta.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
    <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
      <Link href="/" className="text-sm font-semibold text-violet-700">VALLEX</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Criar conta da equipe</h1>
      <p className="mt-3 text-slate-600">Este cadastro é para sócios e funcionários da VALLEX. Ele não cria perfil de prestador, negócio ou vitrine. O administrador define seu cargo e libera as permissões.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="grid gap-1 text-sm font-medium text-slate-700">E-mail cadastrado pelo administrador
          <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5" placeholder="pessoa@vallex.com.br" />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">Senha
          <PasswordInput required  minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Mínimo de 6 caracteres" />
        </label>
        <label className="flex items-start gap-2 text-sm leading-5 text-slate-600">
          <input type="checkbox" required checked={acceptedLegal} onChange={(event) => setAcceptedLegal(event.target.checked)} className="mt-1 accent-violet-700" />
          <span>Tenho 18 anos ou mais, li e aceito os <Link className="font-semibold text-violet-700 underline" href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</Link> e li a <Link className="font-semibold text-violet-700 underline" href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</Link>.</span>
        </label>
        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
        {message && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900" role="status">{message}</p>}
        <button type="submit" disabled={loading} className="vallex-admin-primary w-full">{loading ? "Criando conta…" : "Criar conta da equipe"}</button>
      </form>
      <p className="mt-5 text-sm text-slate-600">Use exatamente o e-mail que o administrador cadastrou. Após criar a conta, aguarde a liberação do acesso.</p>
      <Link href="/sistema/login?next=%2Fadmin" className="mt-5 inline-block text-sm font-semibold text-violet-700">Já tenho conta da equipe</Link>
    </section>
  </main>;
}
