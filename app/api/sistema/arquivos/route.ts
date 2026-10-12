import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

const BUCKET_LOGOS = "vallex-logos";
const BUCKET_ORCAMENTOS = "vallex-orcamentos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_ANEXO_BYTES = 10 * 1024 * 1024;
const VALIDADE_LINK_SEGUNDOS = 60 * 60 * 24 * 7;

const TIPOS_PERMITIDOS: Record<string, { extensao: string; limite: number }> = {
  "image/jpeg": { extensao: "jpg", limite: MAX_ANEXO_BYTES },
  "image/png": { extensao: "png", limite: MAX_ANEXO_BYTES },
  "image/webp": { extensao: "webp", limite: MAX_ANEXO_BYTES },
  "application/pdf": { extensao: "pdf", limite: MAX_ANEXO_BYTES },
};

function respostaErro(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

function clienteAdmin() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!url || !chave) throw new Error("Configuração administrativa do Supabase indisponível.");
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function clienteAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) throw new Error("Configuração de autenticação indisponível.");
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function contexto(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return { error: respostaErro("Autenticação necessária.", 401) };

  const auth = clienteAuth();
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) return { error: respostaErro("Sessão inválida ou expirada.", 401) };

  const admin = clienteAdmin();
  const { data: organization, error } = await admin
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("Erro ao localizar organização para arquivos:", error);
    return { error: respostaErro("Não foi possível localizar a organização.", 500) };
  }
  if (!organization) return { error: respostaErro("Organização não encontrada.", 403) };
  return { admin, organization };
}

function assinaturaValida(bytes: Buffer, mime: string) {
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (mime === "application/pdf") return bytes.toString("ascii", 0, 5) === "%PDF-";
  return false;
}

async function obterBucket(admin: ReturnType<typeof clienteAdmin>, bucket: string) {
  const { data, error } = await admin.storage.getBucket(bucket);
  if (!error && data) return true;
  return false;
}

export async function POST(request: Request) {
  try {
    const auth = await contexto(request);
    if ("error" in auth) return auth.error;

    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json().catch(() => null) as { acao?: unknown; orcamento_id?: unknown } | null;
      const quoteId = typeof body?.orcamento_id === "string" ? body.orcamento_id : "";
      if (body?.acao !== "links_compartilhamento" || !/^[0-9a-f-]{36}$/i.test(quoteId)) {
        return respostaErro("Solicitação de links inválida.", 400);
      }

      const { data: quote, error: quoteError } = await auth.admin.from("orcamentos")
        .select("id")
        .eq("id", quoteId)
        .eq("organization_id", auth.organization.id)
        .maybeSingle();
      if (quoteError || !quote) return respostaErro("Orçamento não encontrado nesta organização.", quoteError ? 500 : 404);

      const bucket = auth.admin.storage.from(BUCKET_ORCAMENTOS);
      const { data: files, error: listError } = await bucket.list(`${auth.organization.id}/${quoteId}`, {
        limit: 5,
        sortBy: { column: "created_at", order: "asc" },
      });
      if (listError) return respostaErro("Não foi possível carregar os anexos.", 500);
      const validFiles = (files ?? []).filter((file) => file.name && !file.name.startsWith("."));
      if (validFiles.length === 0) return NextResponse.json({ ok: true, links: [] });

      const expiresAt = new Date(Date.now() + VALIDADE_LINK_SEGUNDOS * 1000).toISOString();
      const rows = validFiles.map((file) => ({
        token: randomBytes(12).toString("base64url"),
        organization_id: auth.organization.id,
        quote_id: quoteId,
        storage_path: `${auth.organization.id}/${quoteId}/${file.name}`,
        download_name: String(file.metadata?.nome_original ?? file.name).slice(0, 180),
        expires_at: expiresAt,
      }));
      const { error: insertError } = await auth.admin.from("quote_file_links").insert(rows);
      if (insertError) {
        console.error("Erro ao criar links curtos para anexos:", insertError);
        return respostaErro("Não foi possível preparar os links curtos. Confirme a configuração do banco de dados.", 500);
      }

      const origin = new URL(request.url).origin;
      return NextResponse.json({
        ok: true,
        links: rows.map((row) => ({ name: row.download_name, url: `${origin}/a/${row.token}` })),
      });
    }

    const form = await request.formData();
    const finalidade = form.get("finalidade");
    const arquivo = form.get("arquivo");
    const admin = auth.admin;
    const organization = auth.organization;

    if (!(arquivo instanceof File)) return respostaErro("Selecione um arquivo.", 400);
    if (finalidade !== "logo" && finalidade !== "orcamento") return respostaErro("Finalidade do arquivo inválida.", 400);

    const tipo = TIPOS_PERMITIDOS[arquivo.type];
    const limite = finalidade === "logo" ? MAX_LOGO_BYTES : MAX_ANEXO_BYTES;
    if (!tipo || (finalidade === "logo" && !arquivo.type.startsWith("image/"))) {
      return respostaErro("Formato não permitido. Use JPG, PNG ou WebP para a logo; para anexos, também aceitamos PDF.", 415);
    }
    if (arquivo.size <= 0 || arquivo.size > limite) {
      return respostaErro(finalidade === "logo" ? "A logo deve ter no máximo 2 MB." : "Cada anexo deve ter no máximo 10 MB.", 413);
    }

    const bucket = finalidade === "logo" ? BUCKET_LOGOS : BUCKET_ORCAMENTOS;
    if (!(await obterBucket(admin, bucket))) {
      return respostaErro("O armazenamento ainda não foi configurado no Supabase. Aplique o script supabase/setup_storage.sql e tente novamente.", 503);
    }

    let pasta = organization.id;
    if (finalidade === "orcamento") {
      const quoteId = form.get("orcamento_id");
      if (typeof quoteId !== "string" || !/^[0-9a-f-]{36}$/i.test(quoteId)) {
        return respostaErro("Orçamento inválido para anexar o arquivo.", 400);
      }
      const { data: quote, error } = await admin.from("orcamentos")
        .select("id")
        .eq("id", quoteId)
        .eq("organization_id", organization.id)
        .maybeSingle();
      if (error || !quote) return respostaErro("Orçamento não encontrado nesta organização.", error ? 500 : 404);
      pasta = `${organization.id}/${quote.id}`;
      const { data: currentFiles, error: filesError } = await admin.storage
        .from(bucket)
        .list(pasta, { limit: 5 });
      if (filesError) return respostaErro("Não foi possível conferir os anexos existentes.", 500);
      if ((currentFiles ?? []).filter((item) => item.name && !item.name.startsWith(".")).length >= 5) {
        return respostaErro("Este orçamento pode ter até 5 anexos.", 409);
      }
    }

    const bytes = Buffer.from(await arquivo.arrayBuffer());
    if (!assinaturaValida(bytes, arquivo.type)) return respostaErro("O conteúdo do arquivo não corresponde ao formato informado.", 415);

    const nomeArmazenado = `${crypto.randomUUID()}.${tipo.extensao}`;
    const caminho = finalidade === "logo" ? `${organization.id}/${nomeArmazenado}` : `${pasta}/${nomeArmazenado}`;
    const { error: uploadError } = await admin.storage.from(bucket).upload(caminho, bytes, {
      contentType: arquivo.type,
      cacheControl: "3600",
      upsert: false,
      metadata: { nome_original: arquivo.name.slice(0, 180) },
    });
    if (uploadError) {
      console.error("Erro ao armazenar arquivo:", uploadError);
      return respostaErro("Não foi possível armazenar o arquivo.", 500);
    }

    if (finalidade === "logo") {
      const { data: profile, error: updateError } = await admin
        .from("organization_public_profiles")
        .update({ logo_url: admin.storage.from(bucket).getPublicUrl(caminho).data.publicUrl, updated_at: new Date().toISOString() })
        .eq("organization_id", organization.id)
        .select("logo_url")
        .maybeSingle();
      if (updateError || !profile) {
        await admin.storage.from(bucket).remove([caminho]);
        console.error("Erro ao atualizar logo da Vitrine:", updateError);
        return respostaErro("Não foi possível associar a logo à Vitrine. Salve a configuração da Vitrine e tente novamente.", 409);
      }
      return NextResponse.json({ ok: true, logo_url: profile.logo_url });
    }

    const { data: signed, error: signedError } = await admin.storage
      .from(bucket)
      .createSignedUrl(caminho, VALIDADE_LINK_SEGUNDOS, { download: arquivo.name.slice(0, 180) });
    if (signedError || !signed) {
      console.error("Erro ao gerar acesso ao anexo:", signedError);
      return respostaErro("Arquivo enviado, mas não foi possível gerar o link de acesso.", 500);
    }
    return NextResponse.json({
      ok: true,
      arquivo: { path: caminho, name: arquivo.name.slice(0, 180), signed_url: signed.signedUrl },
    }, { status: 201 });
  } catch (error) {
    console.error("Erro na API de arquivos do sistema:", error);
    return respostaErro("Não foi possível processar o arquivo.", 500);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await contexto(request);
    if ("error" in auth) return auth.error;
    const admin = auth.admin;
    const organization = auth.organization;
    const url = new URL(request.url);
    const quoteId = url.searchParams.get("orcamento_id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(quoteId)) return respostaErro("Orçamento inválido.", 400);

    const { data: quote, error: quoteError } = await admin.from("orcamentos")
      .select("id")
      .eq("id", quoteId)
      .eq("organization_id", organization.id)
      .maybeSingle();
    if (quoteError || !quote) return respostaErro("Orçamento não encontrado nesta organização.", quoteError ? 500 : 404);

    const bucket = admin.storage.from(BUCKET_ORCAMENTOS);
    if (!(await obterBucket(admin, BUCKET_ORCAMENTOS))) return NextResponse.json({ ok: true, arquivos: [] });
    const { data: arquivos, error: listError } = await bucket.list(`${organization.id}/${quoteId}`, {
      limit: 5,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (listError) {
      console.error("Erro ao listar anexos do orçamento:", listError);
      return respostaErro("Não foi possível carregar os anexos.", 500);
    }
    const nomes = (arquivos ?? []).filter((arquivo) => arquivo.name && !arquivo.name.startsWith("."));
    if (nomes.length === 0) return NextResponse.json({ ok: true, arquivos: [] });
    const signed = await bucket.createSignedUrls(
      nomes.map((arquivo) => `${organization.id}/${quoteId}/${arquivo.name}`),
      VALIDADE_LINK_SEGUNDOS
    );
    if (signed.error) return respostaErro("Não foi possível gerar os links dos anexos.", 500);
    return NextResponse.json({
      ok: true,
      arquivos: (signed.data ?? []).map((item, index) => ({
        path: `${organization.id}/${quoteId}/${nomes[index]?.name ?? ""}`,
        name: nomes[index]?.metadata?.nome_original ?? nomes[index]?.name ?? "Anexo",
        signed_url: item.signedUrl,
      })),
    });
  } catch (error) {
    console.error("Erro ao carregar anexos do orçamento:", error);
    return respostaErro("Não foi possível carregar os anexos.", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await contexto(request);
    if ("error" in auth) return auth.error;
    const body = await request.json().catch(() => null) as { orcamento_id?: unknown; path?: unknown } | null;
    const quoteId = typeof body?.orcamento_id === "string" ? body.orcamento_id : "";
    const path = typeof body?.path === "string" ? body.path : "";
    if (!/^[0-9a-f-]{36}$/i.test(quoteId) || !path.startsWith(`${auth.organization.id}/${quoteId}/`)) {
      return respostaErro("Anexo inválido para esta organização.", 400);
    }
    const { data: quote } = await auth.admin.from("orcamentos").select("id")
      .eq("id", quoteId).eq("organization_id", auth.organization.id).maybeSingle();
    if (!quote) return respostaErro("Orçamento não encontrado nesta organização.", 404);
    const { error } = await auth.admin.storage.from(BUCKET_ORCAMENTOS).remove([path]);
    if (error) return respostaErro("Não foi possível remover o anexo.", 500);
    return NextResponse.json({ ok: true });
  } catch {
    return respostaErro("Não foi possível remover o anexo.", 500);
  }
}
