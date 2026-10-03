import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => null);
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (
      !email ||
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { ok: false, message: "Informe um e-mail válido." },
        { status: 400 }
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

    // Localiza a organização da qual o usuário é proprietário.
    const { data: organization, error: organizationError } =
      await supabaseAdmin
        .from("organizations")
        .select("id, name")
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
          message: "Somente o proprietário pode emitir convites.",
        },
        { status: 403 }
      );
    }

    // O token original será entregue uma única vez ao proprietário.
    // No banco será armazenado somente o hash SHA-256.
    const invitationToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256")
      .update(invitationToken)
      .digest("hex");

    const { data: invitationData, error: invitationError } =
      await supabaseAdmin.rpc("create_organization_invitation", {
        p_organization_id: organization.id,
        p_actor_id: userId,
        p_email: email,
        p_token_hash: tokenHash,
      });

    if (invitationError) {
      const databaseMessage = invitationError.message;

      const knownErrors: Record<
        string,
        { status: number; message: string }
      > = {
        INVALID_EMAIL: {
          status: 400,
          message: "Informe um e-mail válido.",
        },
        INVALID_TOKEN_HASH: {
          status: 400,
          message: "Não foi possível gerar o convite.",
        },
        ORGANIZATION_NOT_FOUND: {
          status: 404,
          message: "Organização não encontrada.",
        },
        OWNER_ONLY: {
          status: 403,
          message: "Somente o proprietário pode emitir convites.",
        },
        EMAIL_ALREADY_IN_ORGANIZATION: {
          status: 409,
          message: "Este e-mail já pertence à equipe.",
        },
        INVITATION_ALREADY_PENDING: {
          status: 409,
          message: "Já existe um convite pendente para este e-mail.",
        },
        FREE_PLAN_NOT_CONFIGURED: {
          status: 500,
          message: "O plano Free não está configurado.",
        },
        PLAN_USER_LIMIT_REACHED: {
          status: 409,
          message: "O limite de usuários do plano foi atingido.",
        },
      };

      const matchedError = Object.entries(knownErrors).find(([code]) =>
        databaseMessage.includes(code)
      );

      if (matchedError) {
        const [, response] = matchedError;

        return NextResponse.json(
          { ok: false, message: response.message },
          { status: response.status }
        );
      }

      console.error("Erro ao criar convite:", invitationError);

      return NextResponse.json(
        { ok: false, message: "Não foi possível criar o convite." },
        { status: 500 }
      );
    }

    const invitation = Array.isArray(invitationData)
      ? invitationData[0]
      : invitationData;

    if (!invitation) {
      console.error("A função não retornou os dados do convite.");

      return NextResponse.json(
        { ok: false, message: "O convite não foi confirmado." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Convite criado. Compartilhe o token com o convidado.",
        invitation: {
          id: invitation.invitation_id,
          email,
          expiresAt: invitation.expires_at,
          plan: invitation.plan_code,
          maxUsers: invitation.max_users,
          occupiedSlots: invitation.occupied_slots,
        },
        invitationToken,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro na API de convites:", error);

    return NextResponse.json(
      { ok: false, message: "Ocorreu um erro ao criar o convite." },
      { status: 500 }
    );
  }
}