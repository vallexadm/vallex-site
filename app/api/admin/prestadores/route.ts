import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePlatformPermission } from "@/lib/server/platform-admin";

export const runtime = "nodejs";

function unauthorized(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(request: Request) {
  const access = await requirePlatformPermission(request, "providers", "view");
  if (!access.ok) return access.response;
  const databaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!databaseUrl || !serviceKey) {
    const missing = [
      ["SUPABASE_URL", databaseUrl],
      ["SUPABASE_SECRET_KEY", serviceKey],
    ].filter(([, value]) => !value).map(([name]) => name);
    return unauthorized(`Configuração administrativa incompleta no servidor: ${missing.join(", ")}.`, 503);
  }

  const admin = createClient(databaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [organizationsResult, profilesResult, subscriptionsResult, plansResult] =
    await Promise.all([
      admin.from("organizations").select("id, name, business_type, created_at").order("created_at", { ascending: false }),
      admin.from("organization_public_profiles").select("organization_id, slug, display_name, is_published, service_area, updated_at, admin_removed_at, admin_removed_by, admin_removal_reason"),
      admin.from("organization_subscriptions").select("organization_id, status, current_period_end, plan_id, updated_at").order("updated_at", { ascending: false }),
      admin.from("plans").select("id, name, code"),
    ]);

  const firstError = organizationsResult.error ?? profilesResult.error ?? subscriptionsResult.error ?? plansResult.error;
  if (firstError) {
    console.error("Erro ao carregar organizações na administração VALLEX:", firstError);
    return unauthorized("Não foi possível carregar os prestadores agora.", 500);
  }

  const profilesByOrganization = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.organization_id, profile])
  );
  const publicationHistoryResult = await admin
    .from("organization_publication_history")
    .select("organization_id, action, metadata, created_at")
    .order("created_at", { ascending: false });
  if (publicationHistoryResult.error) {
    console.error("Erro ao carregar histórico de publicação na administração VALLEX:", publicationHistoryResult.error);
    return unauthorized("Não foi possível carregar a situação das vitrines agora.", 500);
  }
  const latestPublicationByOrganization = new Map<string, { action: string; metadata: unknown }>();
  for (const entry of publicationHistoryResult.data ?? []) {
    if (!latestPublicationByOrganization.has(entry.organization_id)) {
      latestPublicationByOrganization.set(entry.organization_id, { action: entry.action, metadata: entry.metadata });
    }
  }
  const subscriptionsByOrganization = new Map();
  const sortedSubscriptions = [...(subscriptionsResult.data ?? [])].sort((a, b) => {
    const currentStatus = (status: string) => ["active", "trialing", "past_due"].includes(status) ? 1 : 0;
    return currentStatus(b.status) - currentStatus(a.status);
  });
  for (const subscription of sortedSubscriptions) {
    if (!subscriptionsByOrganization.has(subscription.organization_id)) {
      subscriptionsByOrganization.set(subscription.organization_id, subscription);
    }
  }
  const plansById = new Map((plansResult.data ?? []).map((plan) => [plan.id, plan]));

  const providers = (organizationsResult.data ?? []).map((organization) => {
    const profile = profilesByOrganization.get(organization.id);
    const subscription = subscriptionsByOrganization.get(organization.id);
    const latestPublication = latestPublicationByOrganization.get(organization.id);
    const latestMetadata = latestPublication?.metadata && typeof latestPublication.metadata === "object"
      ? latestPublication.metadata as Record<string, unknown>
      : null;
    return {
      id: organization.id,
      name: organization.name,
      businessType: organization.business_type,
      createdAt: organization.created_at,
      profile: profile
        ? {
            slug: profile.slug,
            displayName: profile.display_name,
            published: profile.is_published,
            canRepublish: !profile.is_published && !profile.admin_removed_at && latestPublication?.action === "revoked" && latestMetadata?.source === "admin_panel",
            serviceArea: profile.service_area,
            updatedAt: profile.updated_at,
            removedAt: profile.admin_removed_at,
            removedBy: profile.admin_removed_by,
            removalReason: profile.admin_removal_reason,
          }
        : null,
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.current_period_end,
            plan: plansById.get(subscription.plan_id)?.name ?? "Plano não identificado",
            planCode: plansById.get(subscription.plan_id)?.code ?? "unknown",
          }
        : null,
    };
  });

  return NextResponse.json(
    { ok: true, providers },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function PATCH(request: Request) {
  const access = await requirePlatformPermission(request, "providers", "edit");
  if (!access.ok) return access.response;

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return unauthorized("Os dados enviados são inválidos.", 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return unauthorized("Não foi possível ler os dados enviados.", 400);
  }

  const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : "";
  if (!organizationId) return unauthorized("Informe o prestador que será atualizado.", 400);

  if (body.action === "restore") {
    const admin = access.context.supabase;
    const { data: current, error: currentError } = await admin
      .from("organization_public_profiles")
      .select("organization_id, is_published, publication_revoked_at, updated_at, admin_removed_at, admin_removed_by, admin_removal_reason")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (currentError) {
      console.error("Erro ao consultar perfil excluído da vitrine:", currentError);
      return unauthorized("Não foi possível consultar o perfil excluído.", 500);
    }
    if (!current?.admin_removed_at) return unauthorized("Este perfil não está na lista de excluídos.", 409);

    const now = new Date().toISOString();
    const { error: restoreError } = await admin
      .from("organization_public_profiles")
      .update({
        admin_removed_at: null,
        admin_removed_by: null,
        admin_removal_reason: null,
        is_published: false,
        publication_revoked_at: current.publication_revoked_at ?? now,
        updated_at: now,
      })
      .eq("organization_id", organizationId);
    if (restoreError) {
      console.error("Erro ao restaurar perfil na lista de prestadores:", restoreError);
      return unauthorized("Não foi possível restaurar o perfil.", 500);
    }

    const { error: auditError } = await admin.from("organization_publication_history").insert({
      organization_id: organizationId,
      action: "revoked",
      actor_user_id: access.context.userId,
      metadata: { source: "admin_panel", restoredFromAdminRemoval: true },
    });
    if (auditError) {
      console.error("O perfil foi restaurado, mas o histórico não foi registrado:", auditError);
      await admin.from("organization_public_profiles").update({
        admin_removed_at: current.admin_removed_at,
        admin_removed_by: current.admin_removed_by,
        admin_removal_reason: current.admin_removal_reason,
        is_published: current.is_published,
        publication_revoked_at: current.publication_revoked_at,
        updated_at: current.updated_at,
      }).eq("organization_id", organizationId);
      return unauthorized("O perfil não foi restaurado porque não foi possível registrar o histórico.", 500);
    }
    return NextResponse.json({ ok: true, message: "Prestador restaurado para a lista de ativos. A vitrine permanece oculta." }, { headers: { "Cache-Control": "private, no-store" } });
  }

  if (body.action === "edit") {
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const serviceArea = typeof body.serviceArea === "string" ? body.serviceArea.trim() : "";
    if (displayName.length < 2 || displayName.length > 160) {
      return unauthorized("O nome exibido deve ter entre 2 e 160 caracteres.", 400);
    }
    if (serviceArea.length > 300) return unauthorized("A região de atendimento deve ter até 300 caracteres.", 400);

    const { data, error } = await access.context.supabase
      .from("organization_public_profiles")
      .update({ display_name: displayName, service_area: serviceArea || null, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .select("organization_id, slug, display_name, is_published, service_area, updated_at")
      .maybeSingle();
    if (error) {
      console.error("Erro ao atualizar a vitrine do prestador:", error);
      return unauthorized("Não foi possível atualizar os dados da vitrine.", 500);
    }
    if (!data) return unauthorized("Este prestador ainda não tem um perfil de vitrine para editar.", 404);
    return NextResponse.json({ ok: true, profile: data }, { headers: { "Cache-Control": "private, no-store" } });
  }

  if (body.action === "visibility") {
    if (typeof body.published !== "boolean") return unauthorized("Informe se a vitrine deve ficar publicada.", 400);
    const admin = access.context.supabase;
    const { data: current, error: currentError } = await admin
      .from("organization_public_profiles")
      .select("organization_id, is_published, publication_authorized_at, publication_revoked_at, updated_at, admin_removed_at")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (currentError) {
      console.error("Erro ao consultar vitrine do prestador:", currentError);
      return unauthorized("Não foi possível consultar a vitrine deste prestador.", 500);
    }
    if (!current) return unauthorized("Este prestador ainda não tem um perfil de vitrine.", 404);
    if (current.is_published === body.published) return NextResponse.json({ ok: true, published: current.is_published });
    if (body.published && current.admin_removed_at) return unauthorized("Restaure o prestador para a lista de ativos antes de reexibir a vitrine.", 409);

    const now = new Date().toISOString();
    if (body.published) {
      if (!current.publication_authorized_at) return unauthorized("O prestador ainda não autorizou a publicação da vitrine.", 409);
      const { data: latest, error: historyError } = await admin
        .from("organization_publication_history")
        .select("action, metadata")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (historyError) {
        console.error("Erro ao verificar autorização para reexibir a vitrine:", historyError);
        return unauthorized("Não foi possível verificar o histórico de publicação.", 500);
      }
      const metadata = latest?.metadata && typeof latest.metadata === "object" ? latest.metadata as Record<string, unknown> : null;
      if (latest?.action !== "revoked" || metadata?.source !== "admin_panel") {
        return unauthorized("A vitrine foi retirada fora do painel administrativo. Peça ao prestador para publicá-la novamente pela própria conta.", 409);
      }
    }

    const { error: updateError } = await admin
      .from("organization_public_profiles")
      .update({
        is_published: body.published,
        publication_revoked_at: body.published ? null : now,
        updated_at: now,
      })
      .eq("organization_id", organizationId);
    if (updateError) {
      console.error("Erro ao alterar a visibilidade da vitrine:", updateError);
      return unauthorized("Não foi possível alterar a visibilidade da vitrine.", 500);
    }

    const { error: auditError } = await admin.from("organization_publication_history").insert({
      organization_id: organizationId,
      action: body.published ? "authorized" : "revoked",
      actor_user_id: access.context.userId,
      metadata: { source: "admin_panel", previousPublished: current.is_published },
    });
    if (auditError) {
      console.error("A vitrine foi atualizada, mas o histórico não foi registrado:", auditError);
      await admin
        .from("organization_public_profiles")
        .update({
          is_published: current.is_published,
          publication_revoked_at: current.publication_revoked_at,
          updated_at: current.updated_at,
        })
        .eq("organization_id", organizationId);
      return unauthorized("A visibilidade foi alterada, mas não foi possível registrar o histórico da operação.", 500);
    }
    return NextResponse.json({ ok: true, published: body.published }, { headers: { "Cache-Control": "private, no-store" } });
  }

  return unauthorized("Ação de atualização desconhecida.", 400);
}

export async function DELETE(request: Request) {
  const access = await requirePlatformPermission(request, "providers", "delete");
  if (!access.ok) return access.response;

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return unauthorized("Os dados enviados são inválidos.", 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return unauthorized("Não foi possível ler os dados enviados.", 400);
  }
  const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!organizationId) return unauthorized("Informe o prestador cuja vitrine será removida.", 400);
  if (reason.length < 3 || reason.length > 1000) return unauthorized("Informe um motivo de exclusão entre 3 e 1000 caracteres.", 400);

  const admin = access.context.supabase;
  const { data: current, error: lookupError } = await admin
    .from("organization_public_profiles")
    .select("organization_id, is_published, publication_revoked_at, updated_at, admin_removed_at, admin_removed_by, admin_removal_reason")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (lookupError) {
    console.error("Erro ao consultar a vitrine antes da exclusão:", lookupError);
    return unauthorized("Não foi possível consultar a vitrine deste prestador.", 500);
  }
  if (!current) return unauthorized("Este prestador não tem um perfil de vitrine para excluir.", 404);
  if (current.admin_removed_at) return unauthorized("Este prestador já está na lista de excluídos.", 409);

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("organization_public_profiles")
    .update({
      is_published: false,
      publication_revoked_at: now,
      admin_removed_at: now,
      admin_removed_by: access.context.userId,
      admin_removal_reason: reason,
      updated_at: now,
    })
    .eq("organization_id", organizationId);
  if (updateError) {
    console.error("Erro ao marcar o perfil como excluído da vitrine:", updateError);
    return unauthorized("Não foi possível excluir o perfil da vitrine.", 500);
  }

  const { error: auditError } = await admin.from("organization_publication_history").insert({
    organization_id: organizationId,
    action: "revoked",
    actor_user_id: access.context.userId,
    metadata: { source: "admin_panel", adminRemoved: true, reason },
  });
  if (auditError) {
    console.error("O perfil foi excluído, mas o histórico não foi registrado:", auditError);
    await admin.from("organization_public_profiles").update({
      is_published: current.is_published,
      publication_revoked_at: current.publication_revoked_at,
      admin_removed_at: current.admin_removed_at,
      admin_removed_by: current.admin_removed_by,
      admin_removal_reason: current.admin_removal_reason,
      updated_at: current.updated_at,
    }).eq("organization_id", organizationId);
    return unauthorized("A exclusão foi cancelada porque não foi possível registrar o histórico.", 500);
  }

  return NextResponse.json(
    { ok: true, removedAt: now, reason, message: "Perfil movido para a lista de excluídos. A conta e os serviços do prestador foram preservados." },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
