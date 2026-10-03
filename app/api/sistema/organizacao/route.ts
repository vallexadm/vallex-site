import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseSecretKey || !supabaseAnonKey) {
  throw new Error("As variáveis do Supabase não foram configuradas.");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

export async function GET(request: Request) {
  try {
    // 1. Obtém o token enviado pelo usuário autenticado.
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Acesso não autorizado." },
        { status: 401 }
      );
    }

    // 2. Valida a identidade usando o Supabase Auth.
    const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const authAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!authUrl || !authAnonKey) {
  console.error("Configuração de autenticação ausente.");

  return NextResponse.json(
    {
      ok: false,
      message: "Configuração de autenticação incompleta.",
    },
    { status: 500 }
  );
}

const authClient = createClient(authUrl, authAnonKey);

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { ok: false, message: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    const userId = authData.user.id;

    // 3. Procura uma organização da qual o usuário seja proprietário.
    const { data: ownedOrganization, error: ownerError } =
      await supabaseAdmin
        .from("organizations")
        .select("id, name, business_type, owner_id")
        .eq("owner_id", userId)
        .maybeSingle();

    if (ownerError) {
      console.error("Erro ao consultar organização do proprietário:", ownerError);

      return NextResponse.json(
        { ok: false, message: "Não foi possível consultar a organização." },
        { status: 500 }
      );
    }

    // O proprietário tem precedência sobre qualquer associação de membro.
    if (ownedOrganization) {
      return NextResponse.json({
        ok: true,
        organization: {
          id: ownedOrganization.id,
          name: ownedOrganization.name,
          business_type: ownedOrganization.business_type,
        },
        role: "owner",
        permissions: {
          canManageOrganization: true,
          canManageTeam: true,
          canManageSettings: true,
          canManageOperationalData: true,
          canViewOperationalData: true,
          readOnly: false,
        },
      });
    }

    // 4. Se não for proprietário, procura associações de membro.
    const { data: memberships, error: membershipError } =
      await supabaseAdmin
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", userId);

    if (membershipError) {
      console.error("Erro ao consultar associações:", membershipError);

      return NextResponse.json(
        { ok: false, message: "Não foi possível consultar os vínculos." },
        { status: 500 }
      );
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          code: "ORGANIZATION_NOT_FOUND",
          message: "Sua conta ainda não está vinculada a uma organização.",
        },
        { status: 404 }
      );
    }

    // O modelo atual espera um vínculo organizacional por conta.
    if (memberships.length > 1) {
      return NextResponse.json(
        {
          ok: false,
          code: "MULTIPLE_ORGANIZATIONS",
          message:
            "Sua conta está vinculada a mais de uma organização. É necessário definir qual organização será utilizada.",
        },
        { status: 409 }
      );
    }

    const membership = memberships[0];

    // 5. Consulta a organização correspondente ao vínculo validado.
    const { data: organization, error: organizationError } =
      await supabaseAdmin
        .from("organizations")
        .select("id, name, business_type")
        .eq("id", membership.organization_id)
        .maybeSingle();

    if (organizationError) {
      console.error("Erro ao consultar organização vinculada:", organizationError);

      return NextResponse.json(
        { ok: false, message: "Não foi possível carregar a organização." },
        { status: 500 }
      );
    }

    if (!organization) {
      return NextResponse.json(
        {
          ok: false,
          code: "ORGANIZATION_NOT_FOUND",
          message: "A organização vinculada não foi encontrada.",
        },
        { status: 404 }
      );
    }

    // 6. O papel member é o Colaborador de leitura.
    if (membership.role !== "member") {
      return NextResponse.json(
        {
          ok: false,
          code: "ROLE_NOT_CONFIGURED",
          message: "O papel desta conta ainda não está habilitado no sistema.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      organization,
      role: "member",
      permissions: {
        canManageOrganization: false,
        canManageTeam: false,
        canManageSettings: false,
        canManageOperationalData: false,
        canViewOperationalData: true,
        readOnly: true,
      },
    });
  } catch (error) {
    console.error("Erro na API de contexto organizacional:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Ocorreu um erro ao consultar o contexto organizacional.",
      },
      { status: 500 }
    );
  }
}