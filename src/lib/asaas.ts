
export async function testarConexaoAsaas() {
  // Ler as variáveis no momento da execução
  const ASAAS_API_URL = process.env.ASAAS_API_URL?.trim();
  const ASAAS_API_KEY = process.env.ASAAS_API_KEY?.trim();
  const ASAAS_ENV = process.env.ASAAS_ENV?.trim();

  // Diagnóstico específico, sem revelar credenciais
  if (!ASAAS_API_URL) {
    throw new Error("ASAAS_API_URL_AUSENTE");
  }

  if (!ASAAS_API_KEY) {
    throw new Error("ASAAS_API_KEY_AUSENTE");
  }

  if (!ASAAS_ENV) {
    throw new Error("ASAAS_ENV_AUSENTE");
  }

  const response = await fetch(`${ASAAS_API_URL}/myAccount`, {
    method: "GET",
    headers: {
      access_token: ASAAS_API_KEY,
      "Content-Type": "application/json",
      "User-Agent": "VALLEX-ServicoFacil/1.0.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detalhes = await response.text();

    throw new Error(
      `ASAAS_HTTP_${response.status}: ${detalhes}`
    );
  }

  return {
    conectado: true,
    ambiente: ASAAS_ENV,
    status: response.status,
  };
}
