import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type AsaasSubscriptionActionContext = {
  admin: SupabaseClient;
  apiKey: string;
  apiUrl: string;
  organizationId: string;
};

export type AsaasSubscriptionActionContextResult =
  | { ok: true; context: AsaasSubscriptionActionContext }
  | { ok: false; message: string; status: number };

export async function getAsaasSubscriptionActionContext(
  request: Request
): Promise<AsaasSubscriptionActionContextResult> {
  const apiUrl = process.env.ASAAS_API_URL?.trim().replace(/\/+$/, "");
  const environment = process.env.ASAAS_ENV?.trim();
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const expectedApiUrl =
    environment === "sandbox"
      ? "https://api-sandbox.asaas.com/v3"
      : environment === "production"
        ? "https://api.asaas.com/v3"
        : null;
  if (!expectedApiUrl || apiUrl !== expectedApiUrl) {
    return {
      ok: false,
      message: "Configure ASAAS_ENV e ASAAS_API_URL para o mesmo ambiente do Asaas.",
      status: 503,
    };
  }

  if (!apiKey || !supabaseUrl || !serviceKey || !authUrl || !anonKey) {
    return {
      ok: false,
      message: "Configuração de cobrança incompleta.",
      status: 503,
    };
  }

  const accessToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!accessToken) {
    return { ok: false, message: "Autenticação necessária.", status: 401 };
  }

  const authClient = createClient(authUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return { ok: false, message: "Sessão inválida ou expirada.", status: 401 };
  }

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id")
    .eq("owner_id", authData.user.id)
    .maybeSingle();

  if (organizationError) {
    console.error("[ASAAS SUBSCRIPTION] organization lookup failed", organizationError);
    return {
      ok: false,
      message: "Não foi possível consultar sua organização.",
      status: 500,
    };
  }
  if (!organization) {
    return {
      ok: false,
      message: "Configure sua área antes de gerenciar o plano.",
      status: 409,
    };
  }

  return {
    ok: true,
    context: {
      admin,
      apiKey,
      apiUrl,
      organizationId: organization.id,
    },
  };
}
