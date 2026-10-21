import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPlanEntitlements } from "@/lib/server/plan-entitlements";

export const runtime = "nodejs";

type RequestBody = {
  slug?: string;
  vitrine_service_id?: string;
  nome?: string;
  telefone?: string;
  email?: string;
  descricao?: string;
  endereco?: string;
  data_preferida?: string;
  horario_preferido?: string;
  observacoes?: string;
};

function texto(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function emailValido(email: string) {
  if (!email) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function uuidValido(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function POST(request: Request) {
  const previewRequested =
    new URL(request.url).searchParams.get("previsualizar") === "1";

  if (previewRequested && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, message: "O envio de solicitações de teste fica disponível somente no ambiente local." },
      { status: 404 }
    );
  }

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

  let body: RequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Corpo da requisição inválido.",
      },
      { status: 400 }
    );
  }

  const slug = texto(body.slug).toLowerCase();
  const vitrineServiceId = texto(body.vitrine_service_id);

  const nome = texto(body.nome);
  const telefone = texto(body.telefone);
  const email = texto(body.email);
  const descricao = texto(body.descricao);
  const endereco = texto(body.endereco);
  const dataPreferida = texto(body.data_preferida);
  const horarioPreferido = texto(body.horario_preferido);
  const observacoes = texto(body.observacoes);

  if (!slug) {
    return NextResponse.json(
      {
        ok: false,
        message: "Vitrine não informada.",
      },
      { status: 400 }
    );
  }

  if (!vitrineServiceId || !uuidValido(vitrineServiceId)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Serviço inválido.",
      },
      { status: 400 }
    );
  }

  if (nome.length < 2 || nome.length > 160) {
    return NextResponse.json(
      {
        ok: false,
        message: "Informe um nome válido.",
      },
      { status: 400 }
    );
  }

  if (telefone.length < 8 || telefone.length > 40) {
    return NextResponse.json(
      {
        ok: false,
        message: "Informe um telefone válido.",
      },
      { status: 400 }
    );
  }

  if (!email || email.length > 320 || !emailValido(email)) {
  return NextResponse.json(
    {
      ok: false,
      message:
        "Informe um e-mail válido. Ele será utilizado para enviar o orçamento e as informações relacionadas ao seu atendimento.",
    },
    { status: 400 }
  );
}

  if (descricao.length > 5000) {
    return NextResponse.json(
      {
        ok: false,
        message: "A descrição excede o limite permitido.",
      },
      { status: 400 }
    );
  }

  if (endereco.length > 2000) {
    return NextResponse.json(
      {
        ok: false,
        message: "O endereço excede o limite permitido.",
      },
      { status: 400 }
    );
  }

  if (horarioPreferido.length > 100) {
    return NextResponse.json(
      {
        ok: false,
        message: "O horário informado é muito longo.",
      },
      { status: 400 }
    );
  }

  if (observacoes.length > 3000) {
    return NextResponse.json(
      {
        ok: false,
        message: "As observações excedem o limite permitido.",
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
        { ok: false, message: "Entre na área do prestador para testar a solicitação." },
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

    if (organizationError || !organization) {
      return NextResponse.json(
        { ok: false, message: "Não foi possível validar sua organização para o teste." },
        { status: organizationError ? 500 : 403 }
      );
    }

    ownedOrganizationId = organization.id;
  }

  const { data: profile, error: profileError } =
    await supabaseAdmin
      .from("organization_public_profiles")
      .select("organization_id, slug, display_name, is_published")
      .eq("slug", slug)
      .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível validar a Vitrine.",
      },
      { status: 500 }
    );
  }

  if (
    !profile ||
    (previewRequested
      ? profile.organization_id !== ownedOrganizationId
      : !profile.is_published)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Vitrine não encontrada.",
      },
      { status: 404 }
    );
  }

  const { data: service, error: serviceError } =
    await supabaseAdmin
      .from("vitrine_services")
      .select(
        "id, organization_id, name, is_published"
      )
      .eq("id", vitrineServiceId)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

  if (serviceError) {
    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível validar o serviço.",
      },
      { status: 500 }
    );
  }

  if (!service || (!previewRequested && !service.is_published)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Serviço não encontrado ou indisponível.",
      },
      { status: 404 }
    );
  }

  if (!previewRequested) {
    const planResult = await getPlanEntitlements(supabaseAdmin, profile.organization_id);
    if (!planResult.entitlements) return NextResponse.json({ ok: false, message: planResult.error }, { status: 503 });
    const maxServices = planResult.entitlements.maxServices;
    if (maxServices !== null) {
      const { data: activeServices, error: activeServicesError } = await supabaseAdmin
        .from("vitrine_services")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .eq("is_published", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (activeServicesError) return NextResponse.json({ ok: false, message: "Não foi possível validar a disponibilidade do serviço." }, { status: 500 });
      if ((activeServices ?? []).slice(0, maxServices).every((activeService) => activeService.id !== service.id)) {
        return NextResponse.json({ ok: false, message: "Este serviço não está disponível no plano atual." }, { status: 404 });
      }
    }
  }

  const { error: insertError } =
    await supabaseAdmin
      .from("solicitacoes_orcamento")
      .insert({
        organization_id: profile.organization_id,
        vitrine_service_id: service.id,
        customer_id: null,
        orcamento_id: null,
        nome,
        telefone,
        email: email || null,
        descricao: descricao || null,
        endereco: endereco || null,
        data_preferida: dataPreferida || null,
        horario_preferido: horarioPreferido || null,
        observacoes: observacoes || null,
        ...(previewRequested && {
          observacoes: ["[TESTE LOCAL]", observacoes]
            .filter(Boolean)
            .join(" ")
            .slice(0, 3000),
        }),
        status: "nova",
      })
      .select(
        "id,organization_id,vitrine_service_id,nome,telefone,email,descricao,endereco,data_preferida,horario_preferido,observacoes,status,created_at"
      )
      .single();

  if (insertError) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Não foi possível registrar sua solicitação.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: previewRequested
        ? "Solicitação de teste registrada com sucesso."
        : "Solicitação enviada com sucesso.",
    },
    { status: 201 }
  );
}
