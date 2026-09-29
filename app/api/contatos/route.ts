import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("As variáveis do Supabase não foram configuradas.");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const nome = String(body.nome ?? "").trim();
    const telefone = String(body.telefone ?? "").trim();
    const email = String(body.email ?? "").trim();
    const servico = String(body.servico ?? "").trim();
    const descricao = String(body.descricao ?? "").trim();
    const dataPreferida = body.data_preferida || null;
    const horarioPreferido = String(body.horario_preferido ?? "").trim();
    const sugestaoFutura = String(body.sugestao_futura ?? "").trim();

    if (!nome || !telefone || !servico || !descricao) {
      return NextResponse.json(
        {
          ok: false,
          message: "Preencha nome, telefone, serviço e descrição.",
        },
        { status: 400 }
      );
    }

    if (
      nome.length > 120 ||
      telefone.length > 30 ||
      email.length > 150 ||
      servico.length > 100 ||
      descricao.length > 3000 ||
      horarioPreferido.length > 50 ||
      sugestaoFutura.length > 2000
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Um ou mais campos excedem o tamanho permitido.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("contatos").insert({
      nome,
      telefone,
      email: email || null,
      servico,
      descricao,
      data_preferida: dataPreferida,
      horario_preferido: horarioPreferido || null,
      sugestao_futura: sugestaoFutura || null,
    });

    if (error) {
      console.error("Erro ao salvar contato:", error);

      return NextResponse.json(
        {
          ok: false,
          message: "Não foi possível registrar sua solicitação.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Solicitação recebida com sucesso.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro na API de contatos:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Ocorreu um erro ao processar a solicitação.",
      },
      { status: 500 }
    );
  }
}
export async function GET(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Acesso não autorizado." },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const adminUserId = process.env.SUPABASE_ADMIN_USER_ID;

    if (!supabaseUrl || !supabaseAnonKey || !adminUserId) {
      console.error("Configuração de autenticação ou administrador ausente.");

      return NextResponse.json(
        { ok: false, message: "Configuração do sistema incompleta." },
        { status: 500 }
      );
    }

    // Valida o token com o Supabase Auth.
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { ok: false, message: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    // Permite acesso somente à conta administradora configurada.
    if (authData.user.id !== adminUserId) {
      return NextResponse.json(
        { ok: false, message: "Você não tem permissão para visualizar solicitações." },
        { status: 403 }
      );
    }

    // Consulta executada no servidor usando a chave secreta.
    const { data: contatos, error: contatosError } = await supabase
      .from("contatos")
      .select(
        "id, nome, telefone, email, servico, descricao, data_preferida, horario_preferido, sugestao_futura, status, criado_em"
      )
      .order("criado_em", { ascending: false });

    if (contatosError) {
      console.error("Erro ao consultar contatos:", contatosError);

      return NextResponse.json(
        { ok: false, message: "Não foi possível carregar as solicitações." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      contatos: contatos ?? [],
    });
  } catch (error) {
    console.error("Erro na API GET de contatos:", error);

    return NextResponse.json(
      { ok: false, message: "Ocorreu um erro ao carregar as solicitações." },
      { status: 500 }
    );
  }
}
const STATUS_PERMITIDOS = [
  "novo",
  "em_contato",
  "orcamento_enviado",
  "agendado",
  "concluido",
  "cancelado",
] as const;

export async function PATCH(request: Request) {
  try {
    // 1. Exige token de sessão
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Acesso não autorizado." },
        { status: 401 }
      );
    }

    // 2. Confere as configurações necessárias
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const adminUserId = process.env.SUPABASE_ADMIN_USER_ID;

    if (!supabaseUrl || !supabaseAnonKey || !adminUserId) {
      console.error("Configuração de autenticação ou administrador ausente.");

      return NextResponse.json(
        { ok: false, message: "Configuração do sistema incompleta." },
        { status: 500 }
      );
    }

    // 3. Valida o token com o Supabase Auth
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { ok: false, message: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    // 4. Restringe a operação à sua conta administradora
    if (authData.user.id !== adminUserId) {
      return NextResponse.json(
        { ok: false, message: "Você não tem permissão para alterar solicitações." },
        { status: 403 }
      );
    }

    // 5. Valida os dados recebidos
    const body = await request.json();
    const id = String(body.id ?? "").trim();
    const status = String(body.status ?? "").trim();

    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      return NextResponse.json(
        { ok: false, message: "Identificador da solicitação inválido." },
        { status: 400 }
      );
    }

    if (!STATUS_PERMITIDOS.includes(status as (typeof STATUS_PERMITIDOS)[number])) {
      return NextResponse.json(
        { ok: false, message: "Status informado é inválido." },
        { status: 400 }
      );
    }

    // 6. Atualiza o registro no servidor
    const { data: contato, error: updateError } = await supabase
      .from("contatos")
      .update({ status })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (updateError) {
      console.error("Erro ao atualizar status da solicitação:", updateError);

      return NextResponse.json(
        { ok: false, message: "Não foi possível atualizar o status." },
        { status: 500 }
      );
    }

    if (!contato) {
      return NextResponse.json(
        { ok: false, message: "Solicitação não encontrada." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Status atualizado com sucesso.",
      contato,
    });
  } catch (error) {
    console.error("Erro na API PATCH de contatos:", error);

    return NextResponse.json(
      { ok: false, message: "Ocorreu um erro ao atualizar a solicitação." },
      { status: 500 }
    );
  }
}