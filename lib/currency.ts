export function parseCurrencyInput(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (value === null || value === undefined) return Number.NaN;
  let normalized = String(value).trim().replace(/\s|R\$/gi, "");
  if (!normalized) return Number.NaN;
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  if (hasComma && hasDot) normalized = normalized.replace(/\./g, "").replace(",", ".");
  else if (hasComma) normalized = normalized.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) normalized = normalized.replace(/\./g, "");
  const result = Number(normalized);
  return Number.isFinite(result) ? result : Number.NaN;
}

export function formatCurrencyInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const parsed = parseCurrencyInput(value);
  if (!Number.isFinite(parsed)) return String(value);
  return parsed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const units = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function underThousand(value: number): string {
  if (value === 0) return "";
  if (value === 100) return "cem";
  const parts: string[] = [];
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  if (hundred) parts.push(hundreds[hundred]);
  if (rest >= 10 && rest < 20) parts.push(teens[rest - 10]);
  else {
    const ten = Math.floor(rest / 10);
    const unit = rest % 10;
    if (ten) parts.push(tens[ten]);
    if (unit) parts.push(units[unit]);
  }
  return parts.join(" e ");
}

function integerToPortuguese(value: number): string {
  if (value === 0) return "zero";
  const scales = [
    { size: 1_000_000_000_000, singular: "trilhão", plural: "trilhões" },
    { size: 1_000_000_000, singular: "bilhão", plural: "bilhões" },
    { size: 1_000_000, singular: "milhão", plural: "milhões" },
    { size: 1_000, singular: "mil", plural: "mil" },
  ];
  const parts: string[] = [];
  let remainder = value;
  for (const scale of scales) {
    const group = Math.floor(remainder / scale.size);
    if (!group) continue;
    const label = scale.size === 1_000 ? (group === 1 ? "mil" : `${underThousand(group)} mil`) : `${underThousand(group)} ${group === 1 ? scale.singular : scale.plural}`;
    parts.push(label);
    remainder %= scale.size;
  }
  if (remainder) parts.push(underThousand(remainder));
  return parts.join(" e ");
}

export function currencyValueInWords(value: string | number | null | undefined): string {
  const parsed = parseCurrencyInput(value);
  if (!Number.isFinite(parsed) || parsed < 0) return "";
  const cents = Math.round(parsed * 100);
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  const realText = reais ? `${integerToPortuguese(reais)} ${reais === 1 ? "real" : "reais"}` : "";
  const centText = centavos ? `${integerToPortuguese(centavos)} ${centavos === 1 ? "centavo" : "centavos"}` : "";
  return [realText, centText].filter(Boolean).join(" e ") || "zero reais";
}
