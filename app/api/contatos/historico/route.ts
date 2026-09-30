import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("As variáveis do Supabase não foram configuradas.");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function validarAdministrador(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return {
      autorizado: false as const,
      status: 401,
      message: "Acesso não autorizado.",
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminUserId = process.env.SUPABASE_ADMIN_USER_ID;

  if (!url || !anonKey || !adminUserId) {
    return {
      autorizado: false as const,
      status: 500,
      message: "Configuração do sistema incompleta.",
    };
  }

  const authClient = createClient(url, anonKey);
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data.user) {
    return {
      autorizado: false as const,
      status: 401,
      message: "Sessão inválida ou expirada.",
    };
  }

  if (data.user.id !== adminUserId) {
    return {
      autorizado: false as const,
      status: 403,
      message: "Você não tem permissão para acessar o histórico.",
    };
  }

  return {
    autorizado: true as const,
    userId: data.user.id,
  };
}

function idValido(id: string) {
  return /^[0-9a-fA-F-]{36}$/.test(id);
}

export async function GET(request: Request) {
  try {
    const auth = await validarAdministrador(request);

    if (!auth.autorizado) {
      return NextResponse.json(
        { ok: false, message: auth.message },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const contatoId = searchParams.get("contatoId")?.trim() ?? "";

    if (!idValido(contatoId)) {
      return NextResponse.json(
        { ok: false, message: "Identificador da solicitação inválido." },
        { status: 400 }
      );
    }

    const { data: historico, error } = await supabase
      .from("contato_historico")
      .select(
        "id, contato_id, tipo, status_anterior, status_novo, observacao, criado_por, criado_em"
      )
      .eq("contato_id", contatoId)
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("Erro ao consultar histórico:", error);

      return NextResponse.json(
        { ok: false, message: "Não foi possível carregar o histórico." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      historico: historico ?? [],
    });
  } catch (error) {
    console.error("Erro na API GET do histórico:", error);

    return NextResponse.json(
      { ok: false, message: "Ocorreu um erro ao carregar o histórico." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await validarAdministrador(request);

    if (!auth.autorizado) {
      return NextResponse.json(
        { ok: false, message: auth.message },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const contatoId = String(body.contatoId ?? "").trim();
    const observacao = String(body.observacao ?? "").trim();

    if (!idValido(contatoId)) {
      return NextResponse.json(
        { ok: false, message: "Identificador da solicitação inválido." },
        { status: 400 }
      );
    }

    if (!observacao) {
      return NextResponse.json(
        { ok: false, message: "Digite uma anotação antes de salvar." },
        { status: 400 }
      );
    }

    if (observacao.length > 2000) {
      return NextResponse.json(
        { ok: false, message: "A anotação deve ter no máximo 2000 caracteres." },
        { status: 400 }
      );
    }

    const { data: anotacao, error } = await supabase
      .from("contato_historico")
      .insert({
        contato_id: contatoId,
        tipo: "anotacao",
        observacao,
        criado_por: auth.userId,
      })
      .select(
        "id, contato_id, tipo, status_anterior, status_novo, observacao, criado_por, criado_em"
      )
      .single();

    if (error) {
      console.error("Erro ao salvar anotação interna:", error);

      return NextResponse.json(
        { ok: false, message: "Não foi possível salvar a anotação." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Anotação salva com sucesso.",
        anotacao,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro na API POST do histórico:", error);

    return NextResponse.json(
      { ok: false, message: "Ocorreu um erro ao salvar a anotação." },
      { status: 500 }
    );
  }
}