
import { NextResponse } from "next/server";

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

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
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
        {
          ok: false,
          message: "Informe um nome válido.",
        },
        { status: 400 }
      );
    }

    // 2. Validação da empresa
    if (company.length > 150) {
      return NextResponse.json(
        {
          ok: false,
          message: "Nome da empresa muito longo.",
        },
        { status: 400 }
      );
    }

    // 3. Validação do serviço
    const validService = allowedServices.some(
      (allowed) =>
        normalizeService(allowed) === normalizeService(service)
    );

    if (!validService) {
      return NextResponse.json(
        {
          ok: false,
          message: "Selecione um serviço válido.",
          received: service,
        },
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
        {
          ok: false,
          message: "A nota deve ser de 1 a 5.",
        },
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
          message:
            "O depoimento deve conter entre 10 e 1.500 caracteres.",
        },
        { status: 400 }
      );
    }

    // 6. Validação do vídeo (opcional)
    if (videoUrl && !isValidHttpUrl(videoUrl)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Informe um link HTTP ou HTTPS válido.",
        },
        { status: 400 }
      );
    }

    // 7. Validação do consentimento
    if (consent !== true) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "É necessário autorizar o uso do depoimento.",
        },
        { status: 400 }
      );
    }

    // Persistência será conectada ao PostgreSQL na próxima etapa.
    // Não armazenar nem publicar avaliações nesta versão.

    return NextResponse.json({
      ok: true,
      stored: false,
      status: "pending",
      message:
        "Dados validados. O armazenamento ainda não está habilitado.",
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
