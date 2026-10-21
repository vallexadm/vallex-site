import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPlanEntitlements } from "@/lib/server/plan-entitlements";

export const runtime = "nodejs";

type PublicProfile = {
  id: string;
  organization_id: string;
  slug: string;
  display_name: string;
  description: string | null;
  address: string | null;
  service_area: string | null;
  service_modes: string[];
  logo_url: string | null;
  is_published: boolean;
};

export async function GET(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return NextResponse.json(
      { ok: false, message: "Configuração do servidor indisponível." },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const previewRequested = url.searchParams.get("previsualizar") === "1";


  const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let ownedOrganizationId: string | null = null;

  if (previewRequested) {
    const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publicAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";

    if (!publicSupabaseUrl || !publicAnonKey || !token) {
      return NextResponse.json(
        { ok: false, message: "Entre na área do prestador para abrir a prévia." },
        { status: 401 }
      );
    }

    const supabaseAuth = createClient(publicSupabaseUrl, publicAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userResult, error: authError } =
      await supabaseAuth.auth.getUser(token);

    if (authError || !userResult.user) {
      return NextResponse.json(
        { ok: false, message: "Sua sessão expirou. Entre novamente." },
        { status: 401 }
      );
    }

    const { data: organization, error: organizationError } =
      await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("owner_id", userResult.user.id)
        .maybeSingle();

    if (organizationError) {
      console.error("Erro ao validar organização para prévia:", organizationError);
      return NextResponse.json(
        { ok: false, message: "Não foi possível abrir a prévia." },
        { status: 500 }
      );
    }

    ownedOrganizationId = organization?.id ?? null;
  }

  const { data: publishedProfiles, error: profilesError } =
    await supabaseAdmin
      .from("organization_public_profiles")
      .select(
        "id,organization_id,slug,display_name,description,address,service_area,service_modes,logo_url,is_published"
      )
      .eq("is_published", true)
      .order("display_name", { ascending: true });

  if (profilesError) {
    console.error("Erro ao listar Vitrines públicas:", profilesError);
    return NextResponse.json(
      { ok: false, message: "Não foi possível carregar os prestadores." },
      { status: 500 }
    );
  }

  const profiles: Array<PublicProfile & { is_preview: boolean }> =
    (publishedProfiles ?? []).map((profile) => ({
      ...profile,
      is_preview: false,
    }));

  if (ownedOrganizationId) {
    const { data: ownProfile, error: ownProfileError } =
      await supabaseAdmin
        .from("organization_public_profiles")
        .select(
          "id,organization_id,slug,display_name,description,address,service_area,service_modes,logo_url,is_published"
        )
        .eq("organization_id", ownedOrganizationId)
        .maybeSingle();

    if (ownProfileError) {
      console.error("Erro ao carregar Vitrine para prévia:", ownProfileError);
      return NextResponse.json(
        { ok: false, message: "Não foi possível carregar sua prévia." },
        { status: 500 }
      );
    }

    if (ownProfile && !profiles.some((profile) => profile.id === ownProfile.id)) {
      profiles.unshift({ ...ownProfile, is_preview: true });
    }
  }

  if (profiles.length === 0) {
    return NextResponse.json({ ok: true, prestadores: [] });
  }

  const organizationIds = profiles.map((profile) => profile.organization_id);
  const { data: services, error: servicesError } = await supabaseAdmin
    .from("vitrine_services")
    .select(
      "id,organization_id,name,description,price,display_order,is_published"
    )
    .in("organization_id", organizationIds)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (servicesError) {
    console.error("Erro ao carregar serviços do catálogo:", servicesError);
    return NextResponse.json(
      { ok: false, message: "Não foi possível carregar os serviços." },
      { status: 500 }
    );
  }

  const planResults = await Promise.all(profiles.map(async (profile) => ({
    organizationId: profile.organization_id,
    result: await getPlanEntitlements(supabaseAdmin, profile.organization_id),
  })));
  if (planResults.some(({ result }) => !result.entitlements)) {
    return NextResponse.json({ ok: false, message: "Não foi possível verificar os planos dos prestadores." }, { status: 503 });
  }
  const limitsByOrganization = new Map(
    planResults.map(({ organizationId, result }) => [organizationId, result.entitlements ? result.entitlements.maxServices : 1] as const)
  );

  const prestadores = profiles.map((profile) => {
    const activeServices = (services ?? []).filter(
      (service) => service.organization_id === profile.organization_id && (profile.is_preview || service.is_published)
    );
    const configuredLimit = limitsByOrganization.get(profile.organization_id);
    const maxServices = configuredLimit === undefined ? 1 : configuredLimit;
    return {
      ...profile,
      services: maxServices === null ? activeServices : activeServices.slice(0, maxServices),
    };
  });

  return NextResponse.json({ ok: true, prestadores });
}
