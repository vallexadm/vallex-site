import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      message,
    },
    { status }
  );
}

function criarClienteAuth() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Configuração pública do Supabase indisponível."
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
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
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
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

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const token = extrairToken(request);

    if (!token) {
      return errorResponse(
        "Autenticação necessária.",
        401
      );
    }

    const supabaseAuth = criarClienteAuth();

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      return errorResponse(
        "Sessão inválida ou expirada.",
        401
      );
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
        "Erro ao consultar organização:",
        organizationError
      );

      return errorResponse(
        "Não foi possível consultar a organização.",
        500
      );
    }

    if (!organization) {
      return errorResponse(
        "Organização não encontrada.",
        403
      );
    }

    const { id } = await context.params;

    if (!uuidValido(id)) {
      return errorResponse(
        "Identificador da solicitação inválido.",
        400
      );
    }

    const { data: solicitacao, error: solicitacaoError } =
      await supabaseAdmin
        .from("solicitacoes_orcamento")
        .select(`
          id,
          organization_id,
          customer_id,
          nome,
          telefone,
          email,
          endereco,
          descricao,
          observacoes,
          status
        `)
        .eq("id", id)
        .eq("organization_id", organization.id)
        .maybeSingle();

    if (solicitacaoError) {
      console.error(
        "Erro ao consultar solicitação:",
        solicitacaoError
      );

      return errorResponse(
        "Não foi possível consultar a solicitação.",
        500
      );
    }

    if (!solicitacao) {
      return errorResponse(
        "Solicitação não encontrada.",
        404
      );
    }

    if (solicitacao.customer_id) {
      const { data: clienteExistente, error: clienteError } =
        await supabaseAdmin
          .from("customers")
          .select(
            "id,organization_id,name,phone,email,address,notes,created_at,updated_at"
          )
          .eq("id", solicitacao.customer_id)
          .eq("organization_id", organization.id)
          .maybeSingle();

      if (clienteError) {
        console.error(
          "Erro ao consultar cliente vinculado:",
          clienteError
        );

        return errorResponse(
          "Não foi possível consultar o cliente vinculado.",
          500
        );
      }

      if (clienteExistente) {
        return NextResponse.json({
          ok: true,
          message: "Esta solicitação já possui um cliente vinculado.",
          created: false,
          customer: clienteExistente,
          solicitacao: {
            id: solicitacao.id,
            customer_id: solicitacao.customer_id,
            status: solicitacao.status,
          },
        });
      }
    }

    const email = solicitacao.email.trim().toLowerCase();

    let cliente: {
      id: string;
      organization_id: string;
      name: string;
      phone: string | null;
      email: string | null;
      address: string | null;
      notes: string | null;
      created_at: string;
      updated_at: string;
    } | null = null;

    let clienteCriado = false;

    if (email) {
      const { data: clientePorEmail, error: emailError } =
        await supabaseAdmin
          .from("customers")
          .select(
            "id,organization_id,name,phone,email,address,notes,created_at,updated_at"
          )
          .eq("organization_id", organization.id)
          .eq("email", email)
          .limit(1)
          .maybeSingle();

      if (emailError) {
        console.error(
          "Erro ao verificar cliente existente:",
          emailError
        );

        return errorResponse(
          "Não foi possível verificar se o cliente já existe.",
          500
        );
      }

      cliente = clientePorEmail ?? null;
    }

    if (!cliente) {
      const notas = [
        "Cliente cadastrado a partir de solicitação da Vitrine pública.",
        solicitacao.descricao
          ? `Solicitação: ${solicitacao.descricao}`
          : "",
        solicitacao.observacoes
          ? `Observações: ${solicitacao.observacoes}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const { data: novoCliente, error: insertError } =
        await supabaseAdmin
          .from("customers")
          .insert({
            organization_id: organization.id,
            name: solicitacao.nome.trim(),
            phone: solicitacao.telefone.trim() || null,
            email: email || null,
            address: solicitacao.endereco?.trim() || null,
            notes: notas || null,
          })
          .select(
            "id,organization_id,name,phone,email,address,notes,created_at,updated_at"
          )
          .single();

      if (insertError) {
        console.error(
          "Erro ao criar cliente a partir da solicitação:",
          insertError
        );

        return errorResponse(
          "Não foi possível cadastrar o cliente.",
          500
        );
      }

      cliente = novoCliente;
      clienteCriado = true;
    }

    const { data: solicitacaoAtualizada, error: updateError } =
      await supabaseAdmin
        .from("solicitacoes_orcamento")
        .update({
          customer_id: cliente.id,
          status: "cliente_cadastrado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", solicitacao.id)
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
          updated_at
        `)
        .single();

    if (updateError) {
      console.error(
        "Erro ao vincular cliente à solicitação:",
        updateError
      );

      if (clienteCriado) {
        await supabaseAdmin
          .from("customers")
          .delete()
          .eq("id", cliente.id)
          .eq("organization_id", organization.id);
      }

      return errorResponse(
        "O cliente foi criado, mas não foi possível vinculá-lo à solicitação.",
        500
      );
    }

    return NextResponse.json({
      ok: true,
      message: clienteCriado
        ? "Cliente cadastrado e vinculado à solicitação com sucesso."
        : "Cliente existente localizado e vinculado à solicitação com sucesso.",
      created: clienteCriado,
      customer: cliente,
      solicitacao: solicitacaoAtualizada,
    });
  } catch (error) {
    console.error(
      "POST /api/sistema/solicitacoes/[id]/cliente:",
      error
    );

    return errorResponse(
      "Erro interno ao cadastrar o cliente.",
      500
    );
  }
}