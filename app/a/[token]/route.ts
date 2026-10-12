import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALIDADE_MAXIMA_SEGUNDOS = 60 * 60 * 24 * 7;

function clienteAdmin() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !chave) throw new Error("Configuração administrativa do Supabase indisponível.");
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{16}$/.test(token)) {
    return NextResponse.json({ message: "Este link não é válido." }, { status: 404 });
  }

  try {
    const admin = clienteAdmin();
    const { data: link, error } = await admin.from("quote_file_links")
      .select("storage_path, download_name, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (error) {
      console.error("Erro ao consultar link de anexo:", error);
      return NextResponse.json({ message: "Não foi possível abrir este anexo." }, { status: 503 });
    }

    const segundosRestantes = link
      ? Math.floor((new Date(link.expires_at).getTime() - Date.now()) / 1000)
      : 0;
    if (!link || segundosRestantes <= 0) {
      return NextResponse.json({ message: "Este link expirou ou não existe mais." }, { status: 410 });
    }

    const validade = Math.min(segundosRestantes, VALIDADE_MAXIMA_SEGUNDOS);
    const { data, error: signedError } = await admin.storage
      .from("vallex-orcamentos")
      .createSignedUrl(link.storage_path, validade, { download: link.download_name });
    if (signedError || !data?.signedUrl) {
      console.error("Erro ao gerar acesso temporário ao anexo:", signedError);
      return NextResponse.json({ message: "Não foi possível abrir este anexo." }, { status: 503 });
    }

    return NextResponse.redirect(data.signedUrl, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Erro ao redirecionar para anexo:", error);
    return NextResponse.json({ message: "Não foi possível abrir este anexo." }, { status: 503 });
  }
}
