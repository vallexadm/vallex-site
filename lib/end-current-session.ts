import type { SupabaseClient } from "@supabase/supabase-js";
// Logout deste navegador. O SDK remove a sessao local mesmo em alguns erros remotos.
// Confirmar a ausencia evita prender a interface apos essa limpeza e evita fingir
// sucesso quando a sessao ainda esta ativa.
export async function endCurrentSession(auth: Pick<SupabaseClient["auth"], "signOut" | "getSession">) {
  try { await auth.signOut({ scope: "local" }); } catch { /* Confere o estado local abaixo. */ }
  try {
    const { data, error } = await auth.getSession();
    if (!error && !data.session) return;
  } catch { /* A falha deve ficar visivel junto a acao, sem redirecionar. */ }
  throw new Error("Não foi possível encerrar a sessão neste navegador. Tente novamente.");
}
