import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidMemberPermissions, normalizeMemberPermissions } from "@/lib/team-permissions";

function response(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function PATCH(request: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !secretKey || !authUrl || !anonKey) return response("Configuração do servidor incompleta.", 500);

    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return response("Autenticação necessária.", 401);

    const auth = createClient(authUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data: { user }, error: authError } = await auth.auth.getUser(token);
    if (authError || !user) return response("Sessão inválida ou expirada.", 401);

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return response("Dados de permissão inválidos.", 400);
    const payload = body as Record<string, unknown>;
    const userId = typeof payload.user_id === "string" ? payload.user_id.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return response("Colaborador inválido.", 400);
    if (!isValidMemberPermissions(payload.permissions)) return response("Selecione permissões válidas para cada módulo.", 400);
    const permissions = normalizeMemberPermissions(payload.permissions);

    const { data: organization, error: organizationError } = await admin
      .from("organizations").select("id").eq("owner_id", user.id).maybeSingle();
    if (organizationError) {
      console.error("Erro ao consultar organização para permissões:", organizationError);
      return response("Não foi possível consultar a organização.", 500);
    }
    if (!organization) return response("Somente o proprietário pode configurar permissões.", 403);

    const { data: member, error: memberError } = await admin
      .from("organization_members").update({ permissions })
      .eq("organization_id", organization.id).eq("user_id", userId).eq("role", "member")
      .select("user_id, permissions").maybeSingle();
    if (memberError) {
      console.error("Erro ao salvar permissões do colaborador:", memberError);
      return response("Não foi possível salvar as permissões. Confira se a atualização SQL foi aplicada.", 500);
    }
    if (!member) return response("Colaborador não encontrado nesta organização.", 404);
    return NextResponse.json({ ok: true, permissions: member.permissions, message: "Permissões do colaborador atualizadas." });
  } catch (error) {
    console.error("Erro ao atualizar permissões da equipe:", error);
    return response("Ocorreu um erro ao salvar as permissões.", 500);
  }
}
