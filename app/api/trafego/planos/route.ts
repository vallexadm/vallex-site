import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const fallbackPlans = [
  { code: "local", name: "Presença local", tagline: "Para começar a aparecer para clientes da sua região.", price_label: "Sob proposta", description: "Estrutura inicial de campanha para divulgar seu negócio local.", features: ["Diagnóstico inicial", "Configuração de campanha em um canal", "Acompanhamento e resumo dos resultados"], sort_order: 1 },
  { code: "crescimento", name: "Crescimento", tagline: "Para ampliar a divulgação e acompanhar a evolução.", price_label: "Sob proposta", description: "Gestão contínua de campanhas com otimizações periódicas.", features: ["Planejamento de campanha", "Acompanhamento e otimização periódicos", "Relatório de desempenho"], sort_order: 2 },
  { code: "estrategico", name: "Estratégia completa", tagline: "Para negócios que precisam de uma gestão mais próxima.", price_label: "Sob proposta", description: "Estratégia de divulgação dimensionada conforme os objetivos do negócio.", features: ["Planejamento personalizado", "Gestão de campanhas conforme escopo", "Análise e apresentação dos resultados"], sort_order: 3 },
];

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return NextResponse.json({ ok: true, plans: fallbackPlans });

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase
    .from("traffic_service_plans")
    .select("code,name,tagline,price_label,description,features,sort_order")
    .eq("published", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Não foi possível carregar os planos de tráfego:", error);
    return NextResponse.json({ ok: true, plans: fallbackPlans, usingDefaults: true }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ ok: true, plans: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
