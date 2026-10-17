import { NextResponse } from "next/server";
import { requirePlatformPermission } from "@/lib/server/platform-admin";

export const runtime = "nodejs";

const labels: Record<string, string> = {
  trafego_pago: "Gestão de tráfego pago", servicofacil: "Plano ServiçoFácil", site_institucional: "Site institucional",
  desenvolvimento_web: "Desenvolvimento web / sistema", planilha_automatizada: "Planilha automatizada", consultoria: "Consultoria digital", outro: "Outro produto VALLEX",
};

export async function GET(request: Request) {
  const auth = await requirePlatformPermission(request, "sales", "view");
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.context.supabase.from("vallex_sales_clients")
    .select("product,stage,monthly_value,setup_value,contract_start_date,contract_end_date")
    .is("archived_at", null).limit(5000);
  if (error) {
    return NextResponse.json({ ok: false, message: "Aplique supabase/vendas_vallex.sql para ativar o resumo comercial." }, { status: 503 });
  }
  const records = data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const ongoing = new Set(["proposta", "aguardando_decisao", "negociacao"]);
  const byProduct = new Map<string, { product: string; label: string; closed: number; waiting: number; activeContracts: number; monthlyRevenue: number }>();
  for (const record of records) {
    const current = byProduct.get(record.product) ?? { product: record.product, label: labels[record.product] ?? record.product, closed: 0, waiting: 0, activeContracts: 0, monthlyRevenue: 0 };
    if (record.stage === "ganho") {
      current.closed += 1;
      if ((!record.contract_start_date || record.contract_start_date <= today) && (!record.contract_end_date || record.contract_end_date >= today)) {
        current.activeContracts += 1;
        current.monthlyRevenue += Number(record.monthly_value ?? 0);
      }
    }
    if (ongoing.has(record.stage)) current.waiting += 1;
    byProduct.set(record.product, current);
  }
  return NextResponse.json({
    ok: true,
    summary: {
      customers: records.length,
      closed: records.filter((record) => record.stage === "ganho").length,
      waiting: records.filter((record) => ongoing.has(record.stage)).length,
      activeContracts: Array.from(byProduct.values()).reduce((sum, item) => sum + item.activeContracts, 0),
      monthlyRevenue: Array.from(byProduct.values()).reduce((sum, item) => sum + item.monthlyRevenue, 0),
      byProduct: Array.from(byProduct.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
