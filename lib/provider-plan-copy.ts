export const providerPlanCopy = {
  free: {
    title: "Acompanhe os pedidos que chegam",
    description:
      "Para começar a conhecer as oportunidades recebidas pela VALLEX e falar diretamente com os clientes.",
    features: [
      "Publique 1 serviço na sua Vitrine.",
      "Consulte solicitações em modo somente leitura.",
      "Entre em contato com o cliente pelo WhatsApp.",
      "Acesse o suporte pela plataforma.",
    ],
  },
  basic: {
    title: "Organize o atendimento e a rotina",
    description:
      "Para prestadores que querem cuidar da Vitrine, dos clientes e da operação em um só lugar.",
    features: [
      "Configure sua Vitrine e publique até 5 serviços.",
      "Gerencie solicitações, filtros e orçamentos.",
      "Organize clientes, agenda e financeiro.",
    ],
  },
  professional: {
    title: "Acompanhe resultados e trabalhe em equipe",
    description:
      "Para negócios que precisam compartilhar a gestão e analisar os contatos recebidos.",
    features: [
      "Inclui todos os recursos do Basic.",
      "Publique até 10 serviços na Vitrine.",
      "Exporte solicitações em arquivo CSV.",
      "Mais usuários para dividir a operação.",
    ],
  },
} as const;

export type ProviderPlanCode = keyof typeof providerPlanCopy;

export function getProviderPlanCopy(code: string) {
  return providerPlanCopy[code.toLowerCase() as ProviderPlanCode] ?? {
    title: "Ferramentas para acompanhar seu negócio",
    description: "Consulte os recursos e limites deste plano.",
    features: ["Acesse os recursos informados para o plano."],
  };
}
