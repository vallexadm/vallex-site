import { calculateFuelCost, type FuelCostDetails } from "@/lib/fuel-cost";
import { parseCurrencyInput } from "@/lib/currency";

export const quoteCostCategories = [
  "materiais_insumos",
  "taxas_cartorio",
  "transporte",
  "ferramentas_equipamentos",
  "terceirizados",
  "alimentacao_hospedagem",
  "outros",
] as const;

export type QuoteFuelDetails = {
  distance_km: number;
  fuel_type: "gasolina" | "etanol";
  price_per_liter: number;
  efficiency_km_per_liter: number;
};

export type QuoteInternalCost = {
  category: (typeof quoteCostCategories)[number];
  description: string;
  amount: number;
  fuel_details?: QuoteFuelDetails;
};

export type QuoteCostNormalization =
  | { ok: true; items: QuoteInternalCost[]; total: number }
  | { ok: false; message: string };

export function normalizeQuoteInternalCosts(value: unknown): QuoteCostNormalization {
  if (!Array.isArray(value) || value.length > 30) {
    return { ok: false, message: "Informe até 30 custos internos no orçamento." };
  }

  const items: QuoteInternalCost[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) {
      return { ok: false, message: "Confira os custos internos do orçamento." };
    }
    const row = raw as Record<string, unknown>;
    const category = typeof row.category === "string" ? row.category : "";
    const description = typeof row.description === "string" ? row.description.trim() : "";
    if (!(quoteCostCategories as readonly string[]).includes(category) || description.length < 2 || description.length > 200) {
      return { ok: false, message: "Confira a categoria e a descrição dos custos internos." };
    }

    if (category === "transporte") {
      const fuel = row.fuel_details as Record<string, unknown> | undefined;
      const fuelType = fuel?.fuel_type;
      const details: FuelCostDetails = {
        distance_km: String(fuel?.distance_km ?? ""),
        fuel_type: fuelType === "etanol" ? "etanol" : "gasolina",
        price_per_liter: String(fuel?.price_per_liter ?? ""),
        efficiency_km_per_liter: String(fuel?.efficiency_km_per_liter ?? ""),
      };
      const distance = Number(details.distance_km);
      const price = parseCurrencyInput(details.price_per_liter);
      const efficiency = Number(details.efficiency_km_per_liter);
      const amount = calculateFuelCost(details);
      if ((fuelType !== "gasolina" && fuelType !== "etanol") || ![distance, price, efficiency].every(Number.isFinite) || distance <= 0 || price <= 0 || efficiency <= 0 || amount <= 0) {
        return { ok: false, message: "Preencha distância, combustível, preço por litro e consumo para calcular o transporte." };
      }
      items.push({
        category: category as QuoteInternalCost["category"],
        description,
        amount,
        fuel_details: { distance_km: distance, fuel_type: details.fuel_type, price_per_liter: price, efficiency_km_per_liter: efficiency },
      });
      continue;
    }

    const amount = parseCurrencyInput(typeof row.amount === "number" ? row.amount : String(row.amount ?? ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, message: "Informe um valor maior que zero para cada custo interno." };
    }
    items.push({ category: category as QuoteInternalCost["category"], description, amount: Math.round(amount * 100) / 100 });
  }

  const total = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  return { ok: true, items, total };
}
