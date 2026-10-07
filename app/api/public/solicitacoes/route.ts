import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  const { data: profile, error: profileError } =
    await supabaseAdmin
      .from("organization_public_profiles")
      .select("organization_id, slug, display_name, is_published")
      .eq("slug", slug)
      .eq("is_published", true)
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

  if (!profile) {
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
      .eq("is_published", true)
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

  if (!service) {
    return NextResponse.json(
      {
        ok: false,
        message: "Serviço não encontrado ou indisponível.",
      },
      { status: 404 }
    );
  }

  const { data: solicitacao, error: insertError } =
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
      message: "Solicitação enviada com sucesso.",
      solicitacao,
    },
    { status: 201 }
  );
}