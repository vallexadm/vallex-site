import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const STATUS_VALIDOS = [
  "nova",
  "em_analise",
  "cliente_cadastrado",
  "orcamento_criado",
  "concluida",
  "cancelada",
] as const;

type StatusSolicitacao = (typeof STATUS_VALIDOS)[number];

function criarClienteAnonimo() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configuração pública do Supabase indisponível.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function criarClienteAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Configuração administrativa do Supabase indisponível."
    );
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function extrairToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

function uuidValido(valor: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valor
  );
}

async function autenticarProprietario(request: Request) {
  const token = extrairToken(request);

  if (!token) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          message: "Autenticação necessária.",
        },
        { status: 401 }
      ),
    };
  }

  const supabaseAuth = criarClienteAnonimo();

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser(token);

  if (userError || !user) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          message: "Sessão inválida ou expirada.",
        },
        { status: 401 }
      ),
    };
  }

  const supabaseAdmin = criarClienteAdmin();

  const { data: organization, error: organizationError } =
    await supabaseAdmin
      .from("organizations")
      .select("id,name,owner_id")
      .eq("owner_id", user.id)
      .maybeSingle();

  if (organizationError) {
    console.error(
      "Erro ao localizar organização:",
      organizationError
    );

    return {
      error: NextResponse.json(
        {
          ok: false,
          message: "Não foi possível localizar a organização.",
        },
        { status: 500 }
      ),
    };
  }

  if (!organization) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          message: "Organização não encontrada.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    organization,
    supabaseAdmin,
  };
}

export async function GET(request: Request) {
  try {
    const autenticacao = await autenticarProprietario(request);

    if (autenticacao.error) {
      return autenticacao.error;
    }

    const {
      organization,
      supabaseAdmin,
    } = autenticacao;

    const { data: solicitacoes, error: solicitacoesError } =
      await supabaseAdmin
        .from("solicitacoes_orcamento")
        .select(`
          id,
          organization_id,
          vitrine_service_id,
          customer_id,
          orcamento_id,
          nome,
          telefone,
          email,
          descricao,
          endereco,
          data_preferida,
          horario_preferido,
          observacoes,
          status,
          created_at,
          updated_at,
          vitrine_services (
            id,
            name,
            description,
            price
          )
        `)
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });

    if (solicitacoesError) {
      console.error(
        "Erro ao carregar solicitações:",
        solicitacoesError
      );

      return NextResponse.json(
        {
          ok: false,
          message: "Não foi possível carregar as solicitações.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        organization: {
          id: organization.id,
          name: organization.name,
        },
        solicitacoes: solicitacoes ?? [],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "GET /api/sistema/solicitacoes:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Erro interno ao carregar as solicitações.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const autenticacao = await autenticarProprietario(request);

    if (autenticacao.error) {
      return autenticacao.error;
    }

    const {
      organization,
      supabaseAdmin,
    } = autenticacao;

    let body: {
      id?: unknown;
      status?: unknown;
    };

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

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const status =
      typeof body.status === "string"
        ? body.status.trim()
        : "";

    if (!id || !uuidValido(id)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Identificador da solicitação inválido.",
        },
        { status: 400 }
      );
    }

    if (
      !STATUS_VALIDOS.includes(
        status as StatusSolicitacao
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Status da solicitação inválido.",
        },
        { status: 400 }
      );
    }

    const { data: solicitacaoExistente, error: buscaError } =
      await supabaseAdmin
        .from("solicitacoes_orcamento")
        .select(
          "id,organization_id,nome,status,customer_id,orcamento_id"
        )
        .eq("id", id)
        .eq("organization_id", organization.id)
        .maybeSingle();

    if (buscaError) {
      console.error(
        "Erro ao localizar solicitação:",
        buscaError
      );

      return NextResponse.json(
        {
          ok: false,
          message: "Não foi possível localizar a solicitação.",
        },
        { status: 500 }
      );
    }

    if (!solicitacaoExistente) {
      return NextResponse.json(
        {
          ok: false,
          message: "Solicitação não encontrada.",
        },
        { status: 404 }
      );
    }

    const { data: solicitacaoAtualizada, error: updateError } =
      await supabaseAdmin
        .from("solicitacoes_orcamento")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("organization_id", organization.id)
        .select(`
          id,
          organization_id,
          vitrine_service_id,
          customer_id,
          orcamento_id,
          nome,
          telefone,
          email,
          descricao,
          endereco,
          data_preferida,
          horario_preferido,
          observacoes,
          status,
          created_at,
          updated_at,
          vitrine_services (
            id,
            name,
            description,
            price
          )
        `)
        .single();

    if (updateError) {
      console.error(
        "Erro ao atualizar status da solicitação:",
        updateError
      );

      return NextResponse.json(
        {
          ok: false,
          message: "Não foi possível atualizar o status.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Status atualizado com sucesso.",
        solicitacao: solicitacaoAtualizada,
        status_anterior: solicitacaoExistente.status,
        status_novo: status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "PATCH /api/sistema/solicitacoes:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        message: "Erro interno ao atualizar a solicitação.",
      },
      { status: 500 }
    );
  }
}