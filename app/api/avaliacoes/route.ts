import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const allowedServices = [
  "Informática",
  "Aplicações Web",
  "Sistemas de Gestão",
  "Suporte Técnico",
  "Serviços Elétricos",
  "Consultoria",
  "Outro",
];

// Normaliza textos para evitar diferenças de acentuação e maiúsculas.
function normalizeService(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// Verifica se o link informado é HTTP ou HTTPS.
function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const company = String(body.company ?? "").trim();
    const service = String(body.service ?? "").trim();
    const testimonial = String(body.testimonial ?? "").trim();
    const videoUrl = String(body.videoUrl ?? "").trim();

    const rating = body.rating;
    const consent = body.consent;

    // 1. Validação do nome
    if (!name || name.length > 120) {
      return NextResponse.json(
        { ok: false, message: "Informe um nome válido." },
        { status: 400 }
      );
    }

    // 2. Validação da empresa
    if (company.length > 150) {
      return NextResponse.json(
        { ok: false, message: "Nome da empresa muito longo." },
        { status: 400 }
      );
    }

    // 3. Validação do serviço
    const validService = allowedServices.some(
      (allowed) => normalizeService(allowed) === normalizeService(service)
    );

    if (!validService) {
      return NextResponse.json(
        { ok: false, message: "Selecione um serviço válido." },
        { status: 400 }
      );
    }

    // 4. Validação da nota
    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return NextResponse.json(
        { ok: false, message: "A nota deve ser de 1 a 5." },
        { status: 400 }
      );
    }

    // 5. Validação do depoimento
    if (
      testimonial.length < 10 ||
      testimonial.length > 1500
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "O depoimento deve conter entre 10 e 1.500 caracteres.",
        },
        { status: 400 }
      );
    }

    // 6. Validação do vídeo (opcional)
    if (videoUrl && !isValidHttpUrl(videoUrl)) {
      return NextResponse.json(
        { ok: false, message: "Informe um link HTTP ou HTTPS válido." },
        { status: 400 }
      );
    }

    // 7. Validação do consentimento
    if (consent !== true) {
      return NextResponse.json(
        {
          ok: false,
          message: "É necessário autorizar o uso do depoimento.",
        },
        { status: 400 }
      );
    }

    // 8. Verificação das variáveis de ambiente
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      console.error("Configuração do Supabase ausente no servidor.");

      return NextResponse.json(
        {
          ok: false,
          message: "O serviço de avaliações está temporariamente indisponível.",
        },
        { status: 500 }
      );
    }

    // 9. Conexão ao Supabase no servidor
    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 10. Persistência da avaliação
    const { error } = await supabase.from("avaliacoes").insert({
      nome: name,
      empresa: company || null,
      servico: service,
      nota: rating,
      depoimento: testimonial,
      video_url: videoUrl || null,
      consentimento: true,
      status: "pendente",
    });

    if (error) {
      console.error("Erro ao salvar avaliação no Supabase:", error.message);

      return NextResponse.json(
        {
          ok: false,
          message: "Não foi possível salvar sua avaliação. Tente novamente.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      stored: true,
      status: "pending",
      message:
        "Avaliação recebida e salva. Ela ficará pendente até ser revisada.",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível processar a solicitação.",
      },
      { status: 400 }
    );
  }
}
export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      console.error("Configuração do Supabase ausente no servidor.");

      return NextResponse.json(
        { ok: false, message: "Serviço temporariamente indisponível." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase
      .from("avaliacoes")
      .select("id, nome, empresa, servico, nota, depoimento, video_url, status, criado_em")
      .eq("status", "aprovada")
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("Erro ao consultar avaliações:", error.message);

      return NextResponse.json(
        { ok: false, message: "Não foi possível carregar as avaliações." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, evaluations: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Erro inesperado ao consultar avaliações:", error);

    return NextResponse.json(
      { ok: false, message: "Não foi possível processar a solicitação." },
      { status: 500 }
    );
  }
}