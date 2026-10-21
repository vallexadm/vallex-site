import type { SupabaseClient } from "@supabase/supabase-js";

// O SMTP permanece no Supabase. Não retorna tokens de autenticação ao proprietário.
export async function sendInvitationEmail(auth: SupabaseClient, email: string, invitationToken: string) {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL;
    if (!base) return { status: "not_sent", message: "Configure NEXT_PUBLIC_SITE_URL para enviar o convite por e-mail." };
    const url = new URL("/sistema/convites/aceitar", base);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
      return { status: "not_sent", message: "O endereço do sistema para o convite é inválido." };
    }
    url.searchParams.set("token", invitationToken);
    url.searchParams.set("email", email);
    const { error } = await auth.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: url.toString() },
    });
    if (error) return { status: "not_sent", message: error.status === 429
      ? "O Supabase limitou o envio de e-mails. Aguarde antes de tentar novamente."
      : "O Supabase não confirmou o envio. Confira os logs de Authentication e a configuração SMTP." };
    return { status: "accepted", message: "Envio solicitado ao Supabase. O colaborador deve abrir o e-mail de acesso e confirmar o aceite da equipe. Confira também o spam." };
  } catch {
    return { status: "not_sent", message: "Não foi possível confirmar o envio do e-mail. O convite continua disponível pelo link." };
  }
}
