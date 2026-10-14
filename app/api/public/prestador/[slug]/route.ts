import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return NextResponse.json(
      {
        ok: false,
        message: "Configuração do servidor indisponível.",
      },
      { status: 500 }
    );
  }

  const { slug } = await params;

  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) {
    return NextResponse.json(
      {
        ok: false,
        message: "Slug inválido.",
      },
      { status: 400 }
    );
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data: profile, error: profileError } =
    await supabaseAdmin
      .from("organization_public_profiles")
      .select(
        "id,organization_id,slug,display_name,description,phone,whatsapp,email,address,service_area,service_modes,logo_url,is_published"
      )
      .eq("slug", normalizedSlug)
      .eq("is_published", true)
      .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível carregar a Vitrine.",
      },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json(
      {
        ok: false,
        message: "Vitrine não encontrada.",
      },
      { status: 404 }
    );
  }

  const { data: services, error: servicesError } =
    await supabaseAdmin
      .from("vitrine_services")
      .select(
        "id,name,description,price,display_order,is_published"
      )
      .eq("organization_id", profile.organization_id)
      .eq("is_published", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

  if (servicesError) {
    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível carregar os serviços da Vitrine.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    profile: {
      id: profile.id,
      slug: profile.slug,
      display_name: profile.display_name,
      description: profile.description,
      phone: profile.phone,
      whatsapp: profile.whatsapp,
      email: profile.email,
      address: profile.address,
      service_area: profile.service_area,
      service_modes: profile.service_modes,
      logo_url: profile.logo_url,
      is_published: profile.is_published,
    },
    services: services ?? [],
  });
}
