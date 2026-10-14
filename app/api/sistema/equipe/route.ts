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
      name: null as string | null,
      phone: null as string | null,
    };
  })
);

const memberIds = (members ?? []).map((member) => member.user_id);
const { data: acceptedInvitations, error: acceptedInvitationsError } = memberIds.length
  ? await supabaseAdmin
      .from("organization_invitations")
      .select("accepted_by, invitee_name, contact_phone")
      .eq("organization_id", organization.id)
      .eq("status", "accepted")
      .in("accepted_by", memberIds)
  : { data: [], error: null };

if (acceptedInvitationsError) {
  console.error("Erro ao consultar os contatos dos membros:", acceptedInvitationsError);
  return NextResponse.json(
    { ok: false, message: "Não foi possível consultar os contatos dos membros. Confira a atualização SQL de convites." },
    { status: 500 }
  );
}

const profilesByUser = new Map(
  (acceptedInvitations ?? []).map((invitation) => [invitation.accepted_by, invitation])
);
const membersWithContact = membersWithEmail.map((member) => {
  const profile = profilesByUser.get(member.user_id);
  return {
    ...member,
    name: profile?.invitee_name ?? null,
    phone: profile?.contact_phone ?? null,
  };
});

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
          "id, email, invitee_name, contact_phone, role, status, invited_by, created_at, expires_at"
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

    const { data: subscriptions, error: subscriptionsError } =
      await supabaseAdmin
        .from("organization_subscriptions")
        .select("plan_id")
        .eq("organization_id", organization.id)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1);

    if (subscriptionsError) {
      console.error("Erro ao consultar plano da equipe:", subscriptionsError);

      return NextResponse.json(
        { ok: false, message: "Não foi possível consultar o limite da equipe." },
        { status: 500 }
      );
    }

    const currentSubscription = subscriptions?.[0];
    const planQuery = currentSubscription
      ? supabaseAdmin
          .from("plans")
          .select("code,name,max_users")
          .eq("id", currentSubscription.plan_id)
          .maybeSingle()
      : supabaseAdmin
          .from("plans")
          .select("code,name,max_users")
          .eq("code", "free")
          .eq("is_active", true)
          .maybeSingle();
    const { data: plan, error: planError } = await planQuery;

    if (planError || !plan) {
      console.error("Não foi possível determinar o limite da equipe:", planError);

      return NextResponse.json(
        { ok: false, message: "Não foi possível consultar o limite da equipe." },
        { status: 500 }
      );
    }

    const additionalMemberIds = new Set(
      (members ?? [])
        .map((member) => member.user_id)
        .filter((memberId) => memberId !== organization.owner_id)
    );
    const occupiedSlots =
      1 + additionalMemberIds.size + (invitations ?? []).length;

    return NextResponse.json({
      ok: true,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      members: membersWithContact,
      invitations: invitations ?? [],
      teamCapacity: {
        planCode: plan.code,
        planName: plan.name,
        maxUsers: plan.max_users,
        occupiedSlots,
        availableSlots: Math.max(0, plan.max_users - occupiedSlots),
      },
    });
  } catch (error) {
    console.error("Erro na API de equipe:", error);

    return NextResponse.json(
      { ok: false, message: "Ocorreu um erro ao consultar a equipe." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
    const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const authAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseSecretKey || !authUrl || !authAnonKey) {
      return NextResponse.json({ ok: false, message: "Configuração do servidor incompleta." }, { status: 500 });
    }

    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ ok: false, message: "Acesso não autorizado." }, { status: 401 });

    const body = await request.json().catch(() => null);
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const phoneDigits = phone.replace(/\D/g, "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) || name.length < 2 || name.length > 120 || phone.length > 40 || phoneDigits.length < 8 || phoneDigits.length > 15) {
      return NextResponse.json({ ok: false, message: "Informe nome e telefone válidos." }, { status: 400 });
    }

    const authClient = createClient(authUrl, authAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const adminClient = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ ok: false, message: "Sessão inválida ou expirada." }, { status: 401 });

    const { data: organization, error: organizationError } = await adminClient
      .from("organizations").select("id").eq("owner_id", user.id).maybeSingle();
    if (organizationError) {
      console.error("Erro ao consultar organização para editar membro:", organizationError);
      return NextResponse.json({ ok: false, message: "Não foi possível consultar a organização." }, { status: 500 });
    }
    if (!organization) return NextResponse.json({ ok: false, message: "Somente o proprietário pode editar a equipe." }, { status: 403 });

    const { data: member, error: memberError } = await adminClient
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organization.id)
      .eq("user_id", userId)
      .eq("role", "member")
      .maybeSingle();
    if (memberError) {
      console.error("Erro ao validar membro para edição:", memberError);
      return NextResponse.json({ ok: false, message: "Não foi possível localizar o membro." }, { status: 500 });
    }
    if (!member) return NextResponse.json({ ok: false, message: "Este colaborador não pertence à sua organização." }, { status: 404 });

    const { data: invitation, error: invitationError } = await adminClient
      .from("organization_invitations")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("accepted_by", userId)
      .eq("status", "accepted")
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (invitationError) {
      console.error("Erro ao localizar convite aceito do membro:", invitationError);
      return NextResponse.json({ ok: false, message: "Não foi possível localizar o cadastro do colaborador." }, { status: 500 });
    }
    if (!invitation) return NextResponse.json({ ok: false, message: "Não foi encontrado o cadastro de convite deste colaborador." }, { status: 404 });

    const { error: updateError } = await adminClient
      .from("organization_invitations")
      .update({ invitee_name: name, contact_phone: phone })
      .eq("id", invitation.id)
      .eq("organization_id", organization.id);
    if (updateError) {
      console.error("Erro ao atualizar dados de contato do membro:", updateError);
      return NextResponse.json({ ok: false, message: "Não foi possível salvar nome e telefone." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, member: { user_id: userId, name, phone } });
  } catch (error) {
    console.error("Erro ao editar membro da equipe:", error);
    return NextResponse.json({ ok: false, message: "Ocorreu um erro ao atualizar o membro." }, { status: 500 });
  }
}
