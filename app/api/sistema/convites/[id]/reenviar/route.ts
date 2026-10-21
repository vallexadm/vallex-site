import { sendInvitationEmail } from "@/lib/server/invitation-email";
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
    const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const authAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseSecretKey || !authUrl || !authAnonKey) {
      return NextResponse.json(
        { ok: false, message: "Configuração do servidor incompleta." },
        { status: 500 }
      );
    }

    const bearer = request.headers.get("authorization");
    const accessToken = bearer?.startsWith("Bearer ") ? bearer.slice(7) : null;

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, message: "Acesso não autorizado." },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json(
        { ok: false, message: "Convite inválido." },
        { status: 400 }
      );
    }

    const authClient = createClient(authUrl, authAnonKey);
    const adminClient = createClient(supabaseUrl, supabaseSecretKey);
    const { data: authData, error: authError } =
      await authClient.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return NextResponse.json(
        { ok: false, message: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    const { data: organization, error: organizationError } = await adminClient
      .from("organizations")
      .select("id")
      .eq("owner_id", authData.user.id)
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
        { ok: false, message: "Somente o proprietário pode renovar convites." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    if (body?.action === "send") {
      const rawToken = typeof body.invitationToken === "string" ? body.invitationToken : "";
      if (!/^[a-f0-9]{64}$/i.test(rawToken)) return NextResponse.json({ ok: false, message: "Gere um link antes de enviar." }, { status: 400 });
      const hash = createHash("sha256").update(rawToken).digest("hex");
      const { data: current, error } = await adminClient.from("organization_invitations")
        .select("id, email").eq("id", id).eq("organization_id", organization.id)
        .eq("status", "pending").eq("token_hash", hash).gt("expires_at", new Date().toISOString()).maybeSingle();
      if (error) return NextResponse.json({ ok: false, message: "Não foi possível verificar o convite." }, { status: 503 });
      if (!current) return NextResponse.json({ ok: false, message: "O link expirou, foi substituído ou o convite já foi encerrado. Gere outro link se necessário." }, { status: 409 });
      const emailDelivery = await sendInvitationEmail(authClient, current.email, rawToken);
      return NextResponse.json({ ok: emailDelivery.status === "accepted", emailDelivery, message: emailDelivery.message },
        { status: emailDelivery.status === "accepted" ? 200 : 503 });
    }

    const invitationToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(invitationToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error: updateError } = await adminClient
      .from("organization_invitations")
      .update({ token_hash: tokenHash, expires_at: expiresAt })
      .eq("id", id)
      .eq("organization_id", organization.id)
      .eq("status", "pending")
      .select("id, email, expires_at")
      .maybeSingle();

    if (updateError) {
      console.error("Erro ao renovar convite:", updateError);
      return NextResponse.json(
        { ok: false, message: "Não foi possível gerar um novo link." },
        { status: 500 }
      );
    }

    if (!invitation) {
      return NextResponse.json(
        { ok: false, message: "Este convite não está mais pendente." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Novo link gerado. O anterior foi invalidado. Clique em Enviar convite por e-mail ou compartilhe o link.",

      invitation: {
        id: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expires_at,
      },
      invitationToken,
    });
  } catch (error) {
    console.error("Erro na API para renovar convite:", error);
    return NextResponse.json(
      { ok: false, message: "Ocorreu um erro ao gerar o novo link." },
      { status: 500 }
    );
  }
}
