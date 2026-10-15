"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const pathsWithoutPanel = new Set([
  "/sistema/login",
  "/sistema/planos",
  "/sistema/convites/aceitar",
]);

type AccessState = {
  path: string;
  status: "allowed" | "error";
};

export default function SistemaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [access, setAccess] = useState<AccessState | null>(null);

  useEffect(() => {
    if (pathsWithoutPanel.has(pathname)) return;

    let cancelled = false;

    async function checkPanelAccess() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        if (!token) {
          router.replace("/sistema/login");
          return;
        }

        const response = await fetch("/api/sistema/organizacao", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const result = await response.json();

        if (
          response.status === 404 &&
          result.code === "ORGANIZATION_NOT_FOUND"
        ) {
          if (pathname === "/sistema") {
            if (!cancelled) setAccess({ path: pathname, status: "allowed" });
          } else {
            router.replace("/sistema");
          }
          return;
        }

        if (!response.ok || !result.ok) {
          throw new Error(result.message ?? "Não foi possível verificar seu plano.");
        }

        if (
          result.plan?.code === "free" &&
          result.plan?.canViewRequests === true
        ) {
          if (pathname === "/sistema/solicitacoes") {
            if (!cancelled) setAccess({ path: pathname, status: "allowed" });
          } else {
            router.replace("/sistema/solicitacoes");
          }
          return;
        }

        if (result.plan?.canAccessPanel !== true) {
          router.replace("/sistema/planos?acesso=painel");
          return;
        }

        if (!cancelled) setAccess({ path: pathname, status: "allowed" });
      } catch {
        if (!cancelled) setAccess({ path: pathname, status: "error" });
      }
    }

    void checkPanelAccess();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (pathsWithoutPanel.has(pathname)) return children;

  if (access?.path !== pathname) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-slate-600">
        Verificando acesso ao painel…
      </main>
    );
  }

  if (access.status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-slate-700">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Não foi possível verificar seu plano</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Tente novamente. Se o problema continuar, consulte os planos ou entre em contato com o suporte.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-800"
            >
              Tentar novamente
            </button>
            <a
              href="/sistema/planos"
              className="rounded-lg border border-purple-200 px-4 py-2.5 text-sm font-semibold text-purple-800 transition hover:bg-purple-50"
            >
              Ver planos
            </a>
          </div>
        </section>
      </main>
    );
  }

  return children;
}
