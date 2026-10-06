import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { ok: false, message },
    { status }
  );
}

async function getAuthenticatedUser(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error: errorResponse(
        "Configuração de autenticação incompleta.",
        500
      ),
    };
  }

  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!accessToken) {
    return {
      error: errorResponse("Autenticação necessária.", 401),
    };
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
    error,
  } = await authClient.auth.getUser(accessToken);

  if (error || !user) {
    return {
      error: errorResponse("Sessão inválida ou expirada.", 401),
    };
  }

  return { user };
}

function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function getUserOrganization(
  adminClient: ReturnType<typeof createAdminClient>,
  userId: string
) {
  if (!adminClient) {
    return {
      organization: null,
      error: errorResponse(
        "Configuração do servidor incompleta.",
        500
      ),
    };
  }

  const { data: organization, error } = await adminClient
    .from("organizations")
    .select("id, name, owner_id")
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao consultar organização:", error);

    return {
      organization: null,
      error: errorResponse(
        "Não foi possível consultar a organização.",
        500
      ),
    };
  }

  if (!organization) {
    return {
      organization: null,
      error: errorResponse(
        "Organização não encontrada.",
        403
      ),
    };
  }

  return {
    organization,
    error: null,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);

    if ("error" in auth) {
      return auth.error;
    }

    const adminClient = createAdminClient();

    const { organization, error: organizationResponse } =
      await getUserOrganization(adminClient, auth.user.id);

    if (organizationResponse) {
      return organizationResponse;
    }

    const { data: orcamentos, error } = await adminClient!
      .from("orcamentos")
      .select(
        `
        id,
        organization_id,
        customer_id,
        titulo,
        descricao,
        valor,
        status,
        validade_ate,
        observacoes,
        created_at,
        updated_at,
        customers (
          id,
          name,
          phone,
          email
        )
        `
      )
      .eq("organization_id", organization!.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao consultar orçamentos:", error);

      return errorResponse(
        "Não foi possível carregar os orçamentos.",
        500
      );
    }

    return NextResponse.json({
      ok: true,
      organization: {
        id: organization!.id,
        name: organization!.name,
      },
      orcamentos: orcamentos ?? [],
    });
  } catch (error) {
    console.error("Erro na API GET de orçamentos:", error);

    return errorResponse(
      "Ocorreu um erro ao carregar os orçamentos.",
      500
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);

    if ("error" in auth) {
      return auth.error;
    }

    const adminClient = createAdminClient();

    const { organization, error: organizationResponse } =
      await getUserOrganization(adminClient, auth.user.id);

    if (organizationResponse) {
      return organizationResponse;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Corpo da requisição inválido.",
        400
      );
    }

    if (typeof body !== "object" || body === null) {
      return errorResponse(
        "Dados do orçamento inválidos.",
        400
      );
    }

    const data = body as Record<string, unknown>;

    const customerId =
      typeof data.customer_id === "string"
        ? data.customer_id.trim()
        : "";

    const titulo =
      typeof data.titulo === "string"
        ? data.titulo.trim()
        : "";

    const descricao =
      typeof data.descricao === "string"
        ? data.descricao.trim()
        : "";

    const observacoes =
      typeof data.observacoes === "string"
        ? data.observacoes.trim()
        : "";

    const validadeAte =
      typeof data.validade_ate === "string" &&
      data.validade_ate.trim()
        ? data.validade_ate.trim()
        : null;

    const valor =
      typeof data.valor === "number"
        ? data.valor
        : Number(data.valor);

    if (!customerId || !titulo) {
      return errorResponse(
        "Cliente e título do orçamento são obrigatórios.",
        400
      );
    }

    if (!/^[0-9a-fA-F-]{36}$/.test(customerId)) {
      return errorResponse(
        "Cliente informado é inválido.",
        400
      );
    }

    if (!Number.isFinite(valor) || valor < 0) {
      return errorResponse(
        "Informe um valor válido para o orçamento.",
        400
      );
    }

    if (
      titulo.length > 200 ||
      descricao.length > 5000 ||
      observacoes.length > 5000
    ) {
      return errorResponse(
        "Um ou mais campos excedem o tamanho permitido.",
        400
      );
    }

    if (validadeAte && !/^\d{4}-\d{2}-\d{2}$/.test(validadeAte)) {
      return errorResponse(
        "Data de validade inválida.",
        400
      );
    }

    const { data: customer, error: customerError } =
      await adminClient!
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .eq("organization_id", organization!.id)
        .maybeSingle();

    if (customerError) {
      console.error(
        "Erro ao consultar cliente do orçamento:",
        customerError
      );

      return errorResponse(
        "Não foi possível validar o cliente.",
        500
      );
    }

    if (!customer) {
      return errorResponse(
        "O cliente informado não pertence à organização.",
        404
      );
    }

    const { data: orcamento, error } = await adminClient!
      .from("orcamentos")
      .insert({
        organization_id: organization!.id,
        customer_id: customerId,
        titulo,
        descricao: descricao || null,
        valor,
        status: "rascunho",
        validade_ate: validadeAte,
        observacoes: observacoes || null,
      })
      .select(
        `
        id,
        organization_id,
        customer_id,
        titulo,
        descricao,
        valor,
        status,
        validade_ate,
        observacoes,
        created_at,
        updated_at,
        customers (
          id,
          name,
          phone,
          email
        )
        `
      )
      .single();

    if (error) {
      console.error("Erro ao cadastrar orçamento:", error);

      return errorResponse(
        "Não foi possível cadastrar o orçamento.",
        500
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Orçamento cadastrado com sucesso.",
        orcamento,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro na API POST de orçamentos:", error);

    return errorResponse(
      "Ocorreu um erro ao cadastrar o orçamento.",
      500
    );
  }
}
export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);

    if ("error" in auth) {
      return auth.error;
    }

    const adminClient = createAdminClient();

    const { organization, error: organizationResponse } =
      await getUserOrganization(adminClient, auth.user.id);

    if (organizationResponse) {
      return organizationResponse;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Corpo da requisição inválido.",
        400
      );
    }

    if (typeof body !== "object" || body === null) {
      return errorResponse(
        "Dados do orçamento inválidos.",
        400
      );
    }

    const data = body as Record<string, unknown>;

    const id =
      typeof data.id === "string"
        ? data.id.trim()
        : "";

    const customerId =
      typeof data.customer_id === "string"
        ? data.customer_id.trim()
        : "";

    const titulo =
      typeof data.titulo === "string"
        ? data.titulo.trim()
        : "";

    const descricao =
      typeof data.descricao === "string"
        ? data.descricao.trim()
        : "";

    const observacoes =
      typeof data.observacoes === "string"
        ? data.observacoes.trim()
        : "";

    const status =
      typeof data.status === "string"
        ? data.status.trim()
        : "";

    const validadeAte =
      typeof data.validade_ate === "string" &&
      data.validade_ate.trim()
        ? data.validade_ate.trim()
        : null;

    const valor =
      typeof data.valor === "number"
        ? data.valor
        : Number(data.valor);

    const allowedStatuses = [
      "rascunho",
      "enviado",
      "aprovado",
      "recusado",
      "cancelado",
    ];

    if (!id || !customerId || !titulo) {
      return errorResponse(
        "Orçamento, cliente e título são obrigatórios.",
        400
      );
    }

    if (
      !/^[0-9a-fA-F-]{36}$/.test(id) ||
      !/^[0-9a-fA-F-]{36}$/.test(customerId)
    ) {
      return errorResponse(
        "Identificador inválido.",
        400
      );
    }

    if (!Number.isFinite(valor) || valor < 0) {
      return errorResponse(
        "Informe um valor válido para o orçamento.",
        400
      );
    }

    if (!allowedStatuses.includes(status)) {
      return errorResponse(
        "Status do orçamento inválido.",
        400
      );
    }

    if (
      titulo.length > 200 ||
      descricao.length > 5000 ||
      observacoes.length > 5000
    ) {
      return errorResponse(
        "Um ou mais campos excedem o tamanho permitido.",
        400
      );
    }

    if (
      validadeAte &&
      !/^\d{4}-\d{2}-\d{2}$/.test(validadeAte)
    ) {
      return errorResponse(
        "Data de validade inválida.",
        400
      );
    }

    const { data: customer, error: customerError } =
      await adminClient!
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .eq("organization_id", organization!.id)
        .maybeSingle();

    if (customerError) {
      console.error(
        "Erro ao validar cliente do orçamento:",
        customerError
      );

      return errorResponse(
        "Não foi possível validar o cliente.",
        500
      );
    }

    if (!customer) {
      return errorResponse(
        "O cliente informado não pertence à organização.",
        404
      );
    }

    const { data: orcamento, error } = await adminClient!
      .from("orcamentos")
      .update({
        customer_id: customerId,
        titulo,
        descricao: descricao || null,
        valor,
        status,
        validade_ate: validadeAte,
        observacoes: observacoes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organization!.id)
      .select(
        `
        id,
        organization_id,
        customer_id,
        titulo,
        descricao,
        valor,
        status,
        validade_ate,
        observacoes,
        created_at,
        updated_at,
        customers (
          id,
          name,
          phone,
          email
        )
        `
      )
      .maybeSingle();

    if (error) {
      console.error("Erro ao atualizar orçamento:", error);

      return errorResponse(
        "Não foi possível atualizar o orçamento.",
        500
      );
    }

    if (!orcamento) {
      return errorResponse(
        "Orçamento não encontrado.",
        404
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Orçamento atualizado com sucesso.",
      orcamento,
    });
  } catch (error) {
    console.error(
      "Erro na API PATCH de orçamentos:",
      error
    );

    return errorResponse(
      "Ocorreu um erro ao atualizar o orçamento.",
      500
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);

    if ("error" in auth) {
      return auth.error;
    }

    const adminClient = createAdminClient();

    const { organization, error: organizationResponse } =
      await getUserOrganization(adminClient, auth.user.id);

    if (organizationResponse) {
      return organizationResponse;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Corpo da requisição inválido.",
        400
      );
    }

    if (typeof body !== "object" || body === null) {
      return errorResponse(
        "Dados do orçamento inválidos.",
        400
      );
    }

    const data = body as Record<string, unknown>;

    const id =
      typeof data.id === "string"
        ? data.id.trim()
        : "";

    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      return errorResponse(
        "Identificador do orçamento inválido.",
        400
      );
    }

    const { data: deletedOrcamento, error } =
      await adminClient!
        .from("orcamentos")
        .delete()
        .eq("id", id)
        .eq("organization_id", organization!.id)
        .select("id")
        .maybeSingle();

    if (error) {
      console.error("Erro ao excluir orçamento:", error);

      return errorResponse(
        "Não foi possível excluir o orçamento.",
        500
      );
    }

    if (!deletedOrcamento) {
      return errorResponse(
        "Orçamento não encontrado.",
        404
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Orçamento excluído com sucesso.",
    });
  } catch (error) {
    console.error(
      "Erro na API DELETE de orçamentos:",
      error
    );

    return errorResponse(
      "Ocorreu um erro ao excluir o orçamento.",
      500
    );
  }
}