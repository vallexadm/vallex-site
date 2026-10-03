import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { ok: false, message },
    { status }
  );
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return errorResponse(
      "Configuração do servidor incompleta.",
      500
    );
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!accessToken) {
    return errorResponse("Autenticação necessária.", 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Corpo da requisição inválido.", 400);
  }

  const invitationToken =
    typeof body === "object" &&
    body !== null &&
    "invitationToken" in body &&
    typeof body.invitationToken === "string"
      ? body.invitationToken.trim()
      : "";

  if (!/^[a-f0-9]{64}$/i.test(invitationToken)) {
    return errorResponse("Token do convite inválido.", 400);
  }

  const authClient = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user || !user.email) {
    return errorResponse("Sessão inválida ou expirada.", 401);
  }

  const tokenHash = createHash("sha256")
    .update(invitationToken.toLowerCase())
    .digest("hex");

  const adminClient = createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  const { data, error } = await adminClient.rpc(
    "accept_organization_invitation",
    {
      p_token_hash: tokenHash,
      p_user_id: user.id,
      p_user_email: user.email.trim().toLowerCase(),
    }
  );

  if (error) {
    const errorMessage = error.message ?? "";

    if (errorMessage.includes("INVITATION_NOT_FOUND")) {
      return errorResponse("Convite não encontrado.", 404);
    }

    if (errorMessage.includes("INVITATION_EXPIRED")) {
      return errorResponse("Este convite expirou.", 410);
    }

    if (
      errorMessage.includes("EMAIL_MISMATCH") ||
      errorMessage.includes("USER_ALREADY_OWNER") ||
      errorMessage.includes("USER_ALREADY_MEMBER")
    ) {
      return errorResponse(
        "Este convite não pode ser aceito por esta conta.",
        409
      );
    }

    if (errorMessage.includes("INVITATION_NOT_PENDING")) {
      return errorResponse(
        "Este convite já foi utilizado ou não está pendente.",
        409
      );
    }

    if (errorMessage.includes("PLAN_CAPACITY_EXCEEDED")) {
      return errorResponse(
        "A organização não possui vagas disponíveis no plano atual.",
        409
      );
    }

    if (errorMessage.includes("PLAN_CONFIGURATION_ERROR")) {
      return errorResponse(
        "Não foi possível validar o limite do plano.",
        500
      );
    }

    console.error("Erro ao aceitar convite:", error);
    return errorResponse("Não foi possível aceitar o convite.", 500);
  }

  const acceptedInvitation = Array.isArray(data) ? data[0] : null;

  if (!acceptedInvitation) {
    return errorResponse(
      "O banco não retornou os dados da associação.",
      500
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Convite aceito. Você agora faz parte da equipe.",
      organization: {
        id: acceptedInvitation.organization_id,
        name: acceptedInvitation.organization_name,
      },
      membershipId: acceptedInvitation.membership_id,
    },
    { status: 200 }
  );
}