import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(
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

    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json({ ok: false, message: "Acesso não autorizado." }, { status: 401 });
    }

    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ ok: false, message: "Convite inválido." }, { status: 400 });
    }

    const authClient = createClient(authUrl, authAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ ok: false, message: "Sessão inválida ou expirada." }, { status: 401 });
    }

    const { data: organization, error: organizationError } = await adminClient
      .from("organizations")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (organizationError) {
      console.error("Erro ao consultar organização para cancelar convite:", organizationError);
      return NextResponse.json({ ok: false, message: "Não foi possível consultar a organização." }, { status: 500 });
    }
    if (!organization) {
      return NextResponse.json({ ok: false, message: "Somente o proprietário pode cancelar convites." }, { status: 403 });
    }

    const { data: invitation, error: updateError } = await adminClient
      .from("organization_invitations")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organization.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("Erro ao cancelar convite:", updateError);
      return NextResponse.json({ ok: false, message: "Não foi possível cancelar o convite." }, { status: 500 });
    }
    if (!invitation) {
      return NextResponse.json({ ok: false, message: "Este convite não está mais pendente." }, { status: 409 });
    }

    return NextResponse.json({ ok: true, message: "Convite cancelado. O link foi invalidado e a vaga liberada." });
  } catch (error) {
    console.error("Erro ao cancelar convite:", error);
    return NextResponse.json({ ok: false, message: "Ocorreu um erro ao cancelar o convite." }, { status: 500 });
  }
}
