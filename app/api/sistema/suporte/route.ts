import { hasMemberAffiliation } from "@/lib/server/member-affiliation";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPPORT_TOOLS } from "@/lib/support-tools";
import { getPlanEntitlements } from "@/lib/server/plan-entitlements";

export const runtime = "nodejs";

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("A configuração do banco não está completa.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: Request) {
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!authUrl || !anonKey) return fail("A configuração de autenticação não está completa.", 503);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail("Entre na sua conta para consultar o suporte.", 401);

  const authClient = createClient(authUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return fail("Sua sessão expirou. Entre novamente.", 401);

  try {
    const admin = createAdminClient();
    const { data: requests, error } = await admin
      .from("contatos")
      .select("id, servico, descricao, ferramenta, plano_nome, status, criado_em")
      .eq("solicitante_id", authData.user.id)
      .eq("origem", "acesso_prestador")
      .order("criado_em", { ascending: false });
    if (error) {
      console.error("Erro ao carregar solicitações de suporte do prestador:", error);
      return fail("Não foi possível carregar suas solicitações de suporte.", 500);
    }
    return NextResponse.json({ ok: true, solicitacoes: requests ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Erro ao consultar suporte do prestador:", error);
    return fail("Ocorreu um erro ao consultar o suporte.", 500);
  }
}

export async function POST(request: Request) {
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!authUrl || !anonKey) return fail("A configuração de autenticação não está completa.", 503);

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return fail("Entre na sua conta para falar com o suporte.", 401);

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fail("Os dados enviados são inválidos.", 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("Não foi possível ler os dados enviados.", 400);
  }

  const tool = typeof body.ferramenta === "string" ? body.ferramenta.trim() : "";
  const subject = typeof body.servico === "string" ? body.servico.trim() : "";
  const description = typeof body.descricao === "string" ? body.descricao.trim() : "";
  const phone = typeof body.telefone === "string" ? body.telefone.trim() : "";
  if (!SUPPORT_TOOLS.includes(tool as (typeof SUPPORT_TOOLS)[number])) return fail("Escolha uma ferramenta da lista.", 400);
  if (!subject || subject.length > 100) return fail("Informe um assunto com até 100 caracteres.", 400);
  if (description.length < 10 || description.length > 3000) return fail("Descreva a solicitação entre 10 e 3000 caracteres.", 400);
  if (phone.length < 8 || phone.length > 30) return fail("Informe um telefone ou WhatsApp válido para retorno.", 400);

  const authClient = createClient(authUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return fail("Sua sessão expirou. Entre novamente.", 401);

  try {
    const admin = createAdminClient();
    const user = authData.user;
    let organization: { id: string; name: string } | null = null;

    const { data: owned, error: ownerError } = await admin
      .from("organizations")
      .select("id, name")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (ownerError) return fail("Não foi possível consultar o negócio conectado.", 500);
    organization = await hasMemberAffiliation(admin, user.id) ? null : owned;

    if (!organization) {
      const { data: memberships, error: membershipError } = await admin
        .from("organization_members")
        .select("organization_id")
        .eq("is_active", true).eq("user_id", user.id);
      if (membershipError) return fail("Não foi possível consultar seu vínculo com o negócio.", 500);
      if (!memberships?.length) return fail("Sua conta ainda não está vinculada a um negócio VALLEX.", 403);
      if (memberships.length > 1) return fail("Sua conta está vinculada a mais de um negócio. Entre em contato com a VALLEX.", 409);

      const { data: memberOrganization, error: organizationError } = await admin
        .from("organizations")
        .select("id, name")
        .eq("id", memberships[0].organization_id)
        .maybeSingle();
      if (organizationError) return fail("Não foi possível carregar o negócio conectado.", 500);
      organization = memberOrganization;
    }
    if (!organization) return fail("Não encontramos o negócio conectado à sua conta.", 404);

    const planResult = await getPlanEntitlements(admin, organization.id);
    if (!planResult.entitlements) return fail(planResult.error, 503);

    const metadata = user.user_metadata ?? {};
    const displayName = typeof metadata.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : organization.name;
    const { data: requestRecord, error: insertError } = await admin
      .from("contatos")
      .insert({
        nome: displayName.slice(0, 120),
        telefone: phone,
        email: user.email?.slice(0, 150) || null,
        servico: subject,
        descricao: description,
        sugestao_futura: null,
        origem: "acesso_prestador",
        organization_id: organization.id,
        solicitante_id: user.id,
        ferramenta: tool,
        plano_codigo: planResult.entitlements.code,
        plano_nome: planResult.entitlements.name,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Erro ao registrar solicitação de suporte do prestador:", insertError);
      return fail("Não foi possível enviar sua solicitação agora. Tente novamente.", 500);
    }

    return NextResponse.json({ ok: true, id: requestRecord.id, message: "Solicitação enviada ao suporte VALLEX." }, { status: 201 });
  } catch (error) {
    console.error("Erro ao processar solicitação de suporte do prestador:", error);
    return fail("Ocorreu um erro ao processar sua solicitação.", 500);
  }
}
