
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function erro(message: string, status: number) {
  return NextResponse.json(
    { ok: false, message },
    { status }
  );
}

function criarAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Configuração pública do Supabase indisponível.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function criarAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Configuração administrativa do Supabase indisponível.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function extrairToken(request: Request) {
  const authorization = request.headers.get("authorization");

  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function uuidValido(valor: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valor
  );
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  const token = extrairToken(request);

  if (!token) {
    return erro("Autenticação necessária.", 401);
  }

  let admin: ReturnType<typeof criarAdmin> | null = null;
  let novoOrcamentoId: string | null = null;
  let organizacaoId: string | null = null;

  try {
    // 1. Validar sessão.
    const auth = criarAuth();
    const {
      data: { user },
      error: authError,
    } = await auth.auth.getUser(token);

    if (authError || !user) {
      return erro("Sessão inválida ou expirada.", 401);
    }

    // 2. Obter a organização do proprietário.
    admin = criarAdmin();

    const { data: organizacao, error: orgError } = await admin
      .from("organizations")
      .select("id, owner_id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (orgError) {
      console.error("Erro ao consultar organização:", orgError);
      return erro("Não foi possível consultar a organização.", 500);
    }

    if (!organizacao) {
      return erro("Organização não encontrada.", 403);
    }

    organizacaoId = organizacao.id;

    // 3. Validar solicitação.
    const { id } = await context.params;

    if (!uuidValido(id)) {
      return erro("Identificador da solicitação inválido.", 400);
    }

    const { data: solicitacao, error: solicitacaoError } =
      await admin
        .from("solicitacoes_orcamento")
        .select(`
          id,
          organization_id,
          customer_id,
          orcamento_id,
          nome,
          descricao,
          endereco,
          data_preferida,
          horario_preferido,
          observacoes,
          vitrine_services (
            id,
            name,
            description,
            price
          )
        `)
        .eq("id", id)
        .eq("organization_id", organizacao.id)
        .maybeSingle();

    if (solicitacaoError) {
      console.error("Erro ao consultar solicitação:", solicitacaoError);
      return erro("Não foi possível consultar a solicitação.", 500);
    }

    if (!solicitacao) {
      return erro("Solicitação não encontrada.", 404);
    }

    // 4. Impedir a duplicação.
    if (solicitacao.orcamento_id) {
      return NextResponse.json({
        ok: true,
        created: false,
        message: "Esta solicitação já possui um orçamento vinculado.",
        orcamento_id: solicitacao.orcamento_id,
      });
    }

    if (!solicitacao.customer_id) {
      return erro(
        "Cadastre e vincule o cliente antes de criar o orçamento.",
        409
      );
    }

    // 5. Confirmar que o cliente pertence à organização.
    const { data: cliente, error: clienteError } = await admin
      .from("customers")
      .select("id")
      .eq("id", solicitacao.customer_id)
      .eq("organization_id", organizacao.id)
      .maybeSingle();

    if (clienteError) {
      console.error("Erro ao validar cliente:", clienteError);
      return erro("Não foi possível validar o cliente.", 500);
    }

    if (!cliente) {
      return erro("Cliente não pertence à organização.", 409);
    }

    // 6. Preparar título, descrição e valor inicial.
    const servicoBruto = solicitacao.vitrine_services;
    const servico = Array.isArray(servicoBruto)
      ? servicoBruto[0] ?? null
      : servicoBruto;

    const nomeServico =
      typeof servico?.name === "string" && servico.name.trim()
        ? servico.name.trim()
        : "Serviço solicitado";

    const descricao = [
      servico?.description
        ? `Serviço: ${servico.description}`
        : "",
      solicitacao.descricao
        ? `Pedido do cliente: ${solicitacao.descricao}`
        : "",
    ].filter(Boolean).join("\n\n");

    const observacoes = [
      "Orçamento originado de solicitação da Vitrine pública.",
      solicitacao.endereco
        ? `Endereço: ${solicitacao.endereco}`
        : "",
      solicitacao.data_preferida
        ? `Data preferida: ${solicitacao.data_preferida}`
        : "",
      solicitacao.horario_preferido
        ? `Horário preferido: ${solicitacao.horario_preferido}`
        : "",
      solicitacao.observacoes
        ? `Observações: ${solicitacao.observacoes}`
        : "",
    ].filter(Boolean).join("\n");

    const valor =
      typeof servico?.price === "number" &&
      Number.isFinite(servico.price) &&
      servico.price >= 0
        ? servico.price
        : 0;

    // 7. Criar orçamento como rascunho.
    const { data: orcamento, error: insertError } = await admin
      .from("orcamentos")
      .insert({
        organization_id: organizacao.id,
        customer_id: cliente.id,
        titulo: `Orçamento - ${nomeServico}`,
        descricao: descricao || null,
        valor,
        status: "rascunho",
        validade_ate: null,
        observacoes: observacoes || null,
      })
      .select("id, organization_id, customer_id, titulo, valor, status")
      .single();

    if (insertError || !orcamento) {
      console.error("Erro ao criar orçamento:", insertError);
      return erro("Não foi possível criar o orçamento.", 500);
    }

    novoOrcamentoId = orcamento.id;

    // 8. Vincular apenas se ainda não existir outro vínculo.
    const { data: vinculada, error: vinculoError } = await admin
      .from("solicitacoes_orcamento")
      .update({
        orcamento_id: orcamento.id,
        status: "orcamento_criado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", solicitacao.id)
      .eq("organization_id", organizacao.id)
      .eq("customer_id", cliente.id)
      .is("orcamento_id", null)
      .select("id, orcamento_id, status, updated_at")
      .maybeSingle();

    if (vinculoError || !vinculada) {
      console.error("Erro ao vincular orçamento:", vinculoError);

      // Compensação para evitar deixar orçamento sem vínculo.
      const { error: exclusaoError } = await admin
        .from("orcamentos")
        .delete()
        .eq("id", orcamento.id)
        .eq("organization_id", organizacao.id)
        .eq("status", "rascunho");

      if (exclusaoError) {
        console.error("Falha ao remover orçamento sem vínculo:", exclusaoError);

        return erro(
          "Falha no vínculo e na limpeza automática. Verifique os registros antes de tentar novamente.",
          500
        );
      }

      novoOrcamentoId = null;

      return erro(
        "Não foi possível vincular o orçamento. Confira a solicitação antes de tentar novamente.",
        409
      );
    }

    novoOrcamentoId = null;

    return NextResponse.json(
      {
        ok: true,
        created: true,
        message: "Orçamento criado e vinculado com sucesso.",
        orcamento,
        solicitacao: vinculada,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar orçamento pela solicitação:", error);

    // Tentar limpar o rascunho se ocorrer uma exceção após a inserção.
    if (admin && novoOrcamentoId && organizacaoId) {
      const { error: limpezaError } = await admin
        .from("orcamentos")
        .delete()
        .eq("id", novoOrcamentoId)
        .eq("organization_id", organizacaoId)
        .eq("status", "rascunho");

      if (limpezaError) {
        console.error("Falha na limpeza do orçamento:", limpezaError);
      }
    }

    return erro("Erro interno ao criar o orçamento.", 500);
  }
}
