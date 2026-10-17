export const SUPPORT_TOOLS = [
  "Acesso e conta",
  "Vitrine e serviços",
  "Solicitações e orçamentos",
  "Agenda",
  "Clientes",
  "Financeiro",
  "Equipe e acessos",
  "Planos e assinatura",
  "Outra ferramenta",
] as const;

export type SupportTool = (typeof SUPPORT_TOOLS)[number];

export type SupportOrigin = "site" | "acesso_prestador";

export function supportOriginLabel(origin: SupportOrigin | string | null | undefined) {
  return origin === "acesso_prestador" ? "Acesso do prestador" : "Site";
}
