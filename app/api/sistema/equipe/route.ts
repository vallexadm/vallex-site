import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
    const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const authAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseSecretKey || !authUrl || !authAnonKey) {
      console.error("Configuração do Supabase incompleta.");

      return NextResponse.json(
        { ok: false, message: "Configuração do servidor incompleta." },
        { status: 500 }
      );
    }

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

    const authClient = createClient(authUrl, authAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { ok: false, message: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    const userId = authData.user.id;

    // Esta rota de gestão de equipe é exclusiva do proprietário.
    const { data: organization, error: organizationError } =
      await supabaseAdmin
        .from("organizations")
        .select("id, name, owner_id")
        .eq("owner_id", userId)
        .maybeSingle();

    if (organizationError) {
      console.error("Erro ao consultar organização:", organizationError);

      return NextResponse.json(
        { ok: false, message: "Não foi possível consultar a organização." },
        { status: 500 }
      );
    }

    if (!organization) {
      return NextResponse.json(
        {
          ok: false,
          code: "OWNER_ORGANIZATION_NOT_FOUND",
          message: "Somente o proprietário pode gerenciar a equipe.",
        },
        { status: 403 }
      );
    }

    const { data: members, error: membersError } = await supabaseAdmin
  .from("organization_members")
  .select("id, user_id, role, created_at")
  .eq("organization_id", organization.id)
  .order("created_at", { ascending: true });

if (membersError) {
  console.error("Erro ao consultar membros:", membersError);

  return NextResponse.json(
    { ok: false, message: "Não foi possível consultar os membros." },
    { status: 500 }
  );
}

const membersWithEmail = await Promise.all(
  (members ?? []).map(async (member) => {
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(member.user_id);

    if (userError) {
      console.error(
        `Não foi possível consultar o usuário ${member.user_id}:`,
        userError
      );
    }

    return {
      ...member,
      email: userData.user?.email ?? null,
    };
  })
);

    if (membersError) {
      console.error("Erro ao consultar membros:", membersError);

      return NextResponse.json(
        { ok: false, message: "Não foi possível consultar os membros." },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();

    const { data: invitations, error: invitationsError } =
      await supabaseAdmin
        .from("organization_invitations")
        .select(
          "id, email, role, status, invited_by, created_at, expires_at"
        )
        .eq("organization_id", organization.id)
        .eq("status", "pending")
        .gt("expires_at", now)
        .order("created_at", { ascending: false });

    if (invitationsError) {
      console.error("Erro ao consultar convites:", invitationsError);

      return NextResponse.json(
        { ok: false, message: "Não foi possível consultar os convites." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      members: membersWithEmail,
      invitations: invitations ?? [],
    });
  } catch (error) {
    console.error("Erro na API de equipe:", error);

    return NextResponse.json(
      { ok: false, message: "Ocorreu um erro ao consultar a equipe." },
      { status: 500 }
    );
  }
}