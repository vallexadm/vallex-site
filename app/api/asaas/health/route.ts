import { NextResponse } from "next/server";
import { testarConexaoAsaas } from "../../../../src/lib/asaas";

export const runtime = "nodejs";

export async function GET() {
  try {
    const resultado = await testarConexaoAsaas();

    return NextResponse.json({
      ok: true,
      mensagem: "Conexão com Asaas estabelecida!",
      ambiente: resultado.ambiente,
      status: resultado.status,
    });
  } catch (error) {
    const mensagem =
      error instanceof Error
        ? error.message
        : "ERRO_DESCONHECIDO";

    console.error("[VALLEX ASAAS]", mensagem);

    return NextResponse.json(
      {
        ok: false,
        mensagem: "Falha na conexão com Asaas.",
        diagnostico: mensagem,
      },
      { status: 502 }
    );
  }
}