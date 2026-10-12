import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseSecretKey || !supabaseAnonKey) {
  throw new Error("As variáveis do Supabase não foram configuradas.");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

function slugifyOrganizationName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

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

export async function POST(request: Request) {
  try {
    const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Entre na sua conta para continuar." },
        { status: 401 }
      );
    }

    if (!authUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { ok: false, message: "Configuração do servidor incompleta." },
        { status: 500 }
      );
    }

    const authClient = createClient(authUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, message: "Sua sessão expirou. Entre novamente." },
        { status: 401 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, message: "Os dados enviados são inválidos." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, message: "Os dados enviados são inválidos." },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const businessType =
      typeof payload.business_type === "string"
        ? payload.business_type.trim()
        : "";

    if (name.length < 2 || name.length > 160) {
      return NextResponse.json(
        { ok: false, message: "O nome deve ter entre 2 e 160 caracteres." },
        { status: 400 }
      );
    }

    if (businessType.length < 2 || businessType.length > 100) {
      return NextResponse.json(
        {
          ok: false,
          message: "Informe sua atividade principal (até 100 caracteres).",
        },
        { status: 400 }
      );
    }

    const { data: existingOrganization, error: existingError } =
      await supabaseAdmin
        .from("organizations")
        .select("id, name, business_type")
        .eq("owner_id", user.id)
        .maybeSingle();

    if (existingError) {
      console.error("Erro ao verificar organização existente:", existingError);
      return NextResponse.json(
        { ok: false, message: "Não foi possível verificar sua organização." },
        { status: 500 }
      );
    }

    if (existingOrganization) {
      return NextResponse.json({
        ok: true,
        organization: existingOrganization,
        alreadyConfigured: true,
      });
    }

    const { data: freePlan, error: planError } = await supabaseAdmin
      .from("plans")
      .select("id, code, name")
      .eq("code", "free")
      .eq("is_active", true)
      .maybeSingle();

    if (planError) {
      console.error("Erro ao consultar o plano Free:", planError);
      return NextResponse.json(
        { ok: false, message: "Não foi possível consultar os planos." },
        { status: 500 }
      );
    }

    if (!freePlan) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "O plano gratuito ainda não está disponível. Tente novamente mais tarde.",
        },
        { status: 503 }
      );
    }

    const baseSlug = slugifyOrganizationName(name);

    if (baseSlug.length < 3) {
      return NextResponse.json(
        {
          ok: false,
          message: "Use um nome com pelo menos 3 letras ou números.",
        },
        { status: 400 }
      );
    }

    const { data: slugMatch, error: slugError } = await supabaseAdmin
      .from("organization_public_profiles")
      .select("id")
      .eq("slug", baseSlug)
      .maybeSingle();

    if (slugError) {
      console.error("Erro ao verificar endereço da Vitrine:", slugError);
      return NextResponse.json(
        { ok: false, message: "Não foi possível reservar o endereço público." },
        { status: 500 }
      );
    }

    const slug = slugMatch
      ? `${baseSlug.slice(0, 70)}-${user.id.replace(/-/g, "").slice(0, 8)}`
      : baseSlug;

    const { data: organization, error: organizationError } =
      await supabaseAdmin
        .from("organizations")
        .insert({
          name,
          business_type: businessType,
          owner_id: user.id,
        })
        .select("id, name, business_type")
        .single();

    if (organizationError || !organization) {
      if (organizationError?.code === "23505") {
        const { data: createdByAnotherRequest } = await supabaseAdmin
          .from("organizations")
          .select("id, name, business_type")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (createdByAnotherRequest) {
          return NextResponse.json({
            ok: true,
            organization: createdByAnotherRequest,
            alreadyConfigured: true,
          });
        }
      }

      console.error("Erro ao criar organização:", organizationError);
      return NextResponse.json(
        { ok: false, message: "Não foi possível criar sua organização." },
        { status: 500 }
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from("organization_public_profiles")
      .insert({
        organization_id: organization.id,
        slug,
        display_name: name,
        is_published: false,
      });

    if (profileError) {
      console.error("Erro ao criar perfil inicial da Vitrine:", profileError);
      const { error: cleanupError } = await supabaseAdmin
        .from("organizations")
        .delete()
        .eq("id", organization.id);

      if (cleanupError) {
        console.error("Erro ao desfazer organização incompleta:", cleanupError);
      }

      return NextResponse.json(
        { ok: false, message: "Não foi possível iniciar sua Vitrine." },
        { status: 500 }
      );
    }

    const { error: subscriptionError } = await supabaseAdmin
      .from("organization_subscriptions")
      .insert({
        organization_id: organization.id,
        plan_id: freePlan.id,
        billing_provider: "manual",
        status: "active",
      });

    if (subscriptionError) {
      console.error("Erro ao ativar o plano inicial:", subscriptionError);
      const { error: cleanupError } = await supabaseAdmin
        .from("organizations")
        .delete()
        .eq("id", organization.id);

      if (cleanupError) {
        console.error("Erro ao desfazer organização incompleta:", cleanupError);
      }

      return NextResponse.json(
        { ok: false, message: "Não foi possível ativar o plano inicial." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, organization, plan: freePlan },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao configurar organização:", error);
    return NextResponse.json(
      { ok: false, message: "Ocorreu um erro ao configurar sua conta." },
      { status: 500 }
    );
  }
}
