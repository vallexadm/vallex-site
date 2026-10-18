import { parseCurrencyInput } from "@/lib/currency";

export type FuelCostDetails = {
  distance_km: string;
  fuel_type: "gasolina" | "etanol";
  price_per_liter: string;
  efficiency_km_per_liter: string;
};

export function calculateFuelCost(details: FuelCostDetails) {
  const distance = Number(details.distance_km);
  const price = parseCurrencyInput(details.price_per_liter);
  const efficiency = Number(details.efficiency_km_per_liter);
  if (![distance, price, efficiency].every(Number.isFinite) || distance <= 0 || price <= 0 || efficiency <= 0) return 0;
  return Math.round((distance / efficiency) * price * 100) / 100;
}

export function describeFuelCost(details: FuelCostDetails) {
  const fuelLabel = details.fuel_type === "etanol" ? "etanol" : "gasolina";
  const distance = Number(details.distance_km);
  const price = parseCurrencyInput(details.price_per_liter);
  const efficiency = Number(details.efficiency_km_per_liter);
  return `Combustível (${fuelLabel}) · ${distance.toLocaleString("pt-BR")} km totais · ${efficiency.toLocaleString("pt-BR")} km/L · R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/L`;
}

