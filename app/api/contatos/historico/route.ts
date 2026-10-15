import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePlatformPermission } from "@/lib/server/platform-admin";

function createSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("As variáveis do Supabase não foram configuradas.");
  }

  return createClient(supabaseUrl, supabaseSecretKey);
}

async function validarAdministrador(request: Request, action: "view" | "edit" = "view") {
  const access = await requirePlatformPermission(request, "support", action);
  if (!access.ok) {
    const body = await access.response.clone().json().catch(() => ({}));
    return { autorizado: false as const, status: access.response.status, message: body.message ?? "Você não tem permissão para acessar o histórico." };
  }
  return { autorizado: true as const, userId: access.context.userId };
}

function idValido(id: string) {
  return /^[0-9a-fA-F-]{36}$/.test(id);
}

export async function GET(request: Request) {
  try {
    const auth = await validarAdministrador(request, "view");

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

    const supabase = createSupabaseAdmin();
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

    return NextResponse.json(
      {
        ok: true,
        historico: historico ?? [],
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
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
    const auth = await validarAdministrador(request, "edit");

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

    const supabase = createSupabaseAdmin();
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
