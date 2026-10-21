// Mantém a chave inclusive após recarregar a aba ou perder a resposta da API.
// Uma nova baixa só recebe outra chave depois de a API confirmar a anterior.
export function getPaymentRequestId(payload: string): string {
  const storageKey = `vallex:payment:${payload}`;
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(storageKey, id);
  return id;
}

export function completePaymentRequest(payload: string): void {
  sessionStorage.removeItem(`vallex:payment:${payload}`);
}
