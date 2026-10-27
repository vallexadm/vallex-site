"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { endCurrentSession } from "@/lib/end-current-session";
export default function SessionPanelLink() {
  const [current, setCurrent] = useState<{ email: string; admin: boolean } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let disposed = false, revision = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    async function check() {
      const requestId = ++revision;
      try {
        const { data } = await supabase.auth.getSession();
        if (disposed || requestId !== revision) return;
        const session = data.session;
        if (!session) { setCurrent(null); return; }
        // Nunca usa metadata local para conceder entrada administrativa.
        const response = await fetch("/api/admin/access", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
        const result = await response.json();
        if (disposed || requestId !== revision) return;
        if (response.status === 401) { setCurrent(null); return; }
        setCurrent({ email: session.user.email ?? "", admin: response.ok && result.ok === true && (result.isAdmin === true || result.isStaff === true) });
      } catch { if (!disposed && requestId === revision) setCurrent(null); }
    }
    const schedule = () => { const timer = setTimeout(() => { timers.delete(timer); void check(); }, 0); timers.add(timer); };
    schedule();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { revision++; schedule(); });
    return () => { disposed = true; revision++; timers.forEach(clearTimeout); subscription.unsubscribe(); };
  }, []);
  async function logout() {
    setBusy(true); setError("");
    try { await endCurrentSession(supabase.auth); window.location.reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível sair."); setBusy(false); }
  }
  if (!current) return null;
  return <section className="mb-5 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950" aria-label="Conta conectada">
    <p>Você já está conectado{current.email ? ` como ${current.email}` : ""}.</p>
    <div className="mt-3 flex flex-wrap gap-2"><Link href={current.admin ? "/admin" : "/sistema"} className="rounded-lg bg-violet-700 px-4 py-2.5 font-semibold text-white">{current.admin ? "Abrir painel administrativo" : "Abrir painel do prestador"}</Link><button type="button" disabled={busy} onClick={() => void logout()} className="rounded-lg border border-violet-300 px-4 py-2.5 font-semibold text-violet-800 disabled:opacity-50">{busy ? "Saindo…" : "Sair / trocar conta"}</button></div>
    {error && <p role="alert" className="mt-3 text-red-800">{error}</p>}
  </section>;
}
