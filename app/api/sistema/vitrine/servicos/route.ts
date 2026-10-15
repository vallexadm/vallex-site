import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeMemberPermissions, ownerPermissions } from "@/lib/team-permissions";

export const runtime = "nodejs";

function getSupabaseClients() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseSecretKey || !supabaseAnonKey) {
    return null;
  }

  const supabaseAuth = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return {
    supabaseAuth,
    supabaseAdmin,
  };
}

async function autenticarOwner(request: Request) {
  const clients = getSupabaseClients();

  if (!clients) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          message: "Configuração do servidor indisponível.",
        },
        { status: 500 }
      ),
    };
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          message: "Autenticação necessária.",
        },
        { status: 401 }
      ),
    };
  }

  const token = authorization.replace("Bearer ", "").trim();

  if (!token) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          message: "Token de autenticação inválido.",
        },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await clients.supabaseAuth.auth.getUser(token);

  if (authError || !user) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          message: "Sessão inválida ou expirada.",
        },
        { status: 401 }
      ),
    };
  }

  const { data: organization, error: organizationError } =
    await clients.supabaseAdmin
      .from("organizations")
      .select("id,name,owner_id")
      .eq("owner_id", user.id)
      .maybeSingle();

  if (organizationError) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          message: "Não foi possível validar a organização.",
        },
        { status: 500 }
      ),
    };
  }

  if (!organization) {
    const { data: membership, error: membershipError } = await clients.supabaseAdmin
      .from("organization_members").select("organization_id, role, permissions").eq("user_id", user.id).maybeSingle();
    if (membershipError) return { error: NextResponse.json({ ok: false, message: "Não foi possível consultar suas permissões." }, { status: 500 }) };
    if (!membership || membership.role !== "member") return { error: NextResponse.json({ ok: false, message: "Organização não encontrada." }, { status: 403 }) };
    const { data: memberOrganization, error: memberOrganizationError } = await clients.supabaseAdmin
      .from("organizations").select("id,name,owner_id").eq("id", membership.organization_id).maybeSingle();
    if (memberOrganizationError || !memberOrganization) return { error: NextResponse.json({ ok: false, message: "Não foi possível validar a organização." }, { status: 500 }) };
    return { supabaseAdmin: clients.supabaseAdmin, user, organization: memberOrganization, permissions: normalizeMemberPermissions(membership.permissions), role: "member" as const };
  }

  return {
    supabaseAdmin: clients.supabaseAdmin,
    user,
    organization,
    permissions: ownerPermissions,
    role: "owner" as const,
  };
}

function validarNome(value: unknown) {
  if (typeof value !== "string") {
    return "Informe o nome do serviço.";
  }

  const nome = value.trim();

  if (nome.length < 2) {
    return "O nome do serviço deve ter pelo menos 2 caracteres.";
  }

  if (nome.length > 160) {
    return "O nome do serviço deve ter no máximo 160 caracteres.";
  }

  return null;
}

function validarDescricao(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return "A descrição do serviço é inválida.";
  }

  if (value.trim().length > 2000) {
    return "A descrição deve ter no máximo 2000 caracteres.";
  }

  return null;
}

function validarPreco(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const preco =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(",", "."))
        : NaN;

  if (!Number.isFinite(preco)) {
    return "O preço informado é inválido.";
  }

  if (preco < 0) {
    return "O preço não pode ser negativo.";
  }

  if (preco > 9999999999.99) {
    return "O preço informado é muito alto.";
  }

  return null;
}

function validarDisplayOrder(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const ordem = Number(value);

  if (!Number.isInteger(ordem) || ordem < 0) {
    return "A ordem de exibição deve ser um número inteiro maior ou igual a zero.";
  }

  if (ordem > 999) {
    return "A ordem de exibição deve ser no máximo 999.";
  }

  return null;
}

async function validarCatalogItem(
    supabaseAdmin: SupabaseClient,
    organizationId: string,
    catalogItemId: string | null
) {
  if (!catalogItemId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("catalog_items")
    .select("id")
    .eq("id", catalogItemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    return "Não foi possível validar o serviço do catálogo.";
  }

  if (!data) {
    return "O serviço do catálogo não pertence à organização.";
  }

  return null;
}

export async function GET(request: Request) {
  const auth = await autenticarOwner(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!auth.permissions.services.view) return NextResponse.json({ ok: false, message: "O proprietário ainda não liberou a consulta do catálogo de serviços para sua conta." }, { status: 403 });

  const { data, error } = await auth.supabaseAdmin
    .from("vitrine_services")
    .select(
      "id,organization_id,catalog_item_id,name,description,price,is_published,display_order,created_at,updated_at"
    )
    .eq("organization_id", auth.organization.id)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível carregar os serviços da Vitrine.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    permissions: auth.permissions,
    services: data ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await autenticarOwner(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!auth.permissions.services.manage) return NextResponse.json({ ok: false, message: "O proprietário ainda não liberou alterações no catálogo de serviços para sua conta." }, { status: 403 });

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "JSON inválido.",
      },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      {
        ok: false,
        message: "Dados inválidos.",
      },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;

  const name =
    typeof payload.name === "string"
      ? payload.name.trim()
      : "";

  const description =
    typeof payload.description === "string"
      ? payload.description.trim() || null
      : payload.description === null ||
          payload.description === undefined
        ? null
        : payload.description;

  const catalogItemId =
    typeof payload.catalog_item_id === "string" &&
    payload.catalog_item_id.trim()
      ? payload.catalog_item_id.trim()
      : null;

  const price =
    payload.price === null ||
    payload.price === undefined ||
    payload.price === ""
      ? null
      : typeof payload.price === "string"
        ? Number(payload.price.replace(",", "."))
        : payload.price;

  const isPublished =
    typeof payload.is_published === "boolean"
      ? payload.is_published
      : false;

  const displayOrder =
    payload.display_order === null ||
    payload.display_order === undefined ||
    payload.display_order === ""
      ? 0
      : Number(payload.display_order);

  const nomeError = validarNome(name);

  if (nomeError) {
    return NextResponse.json(
      {
        ok: false,
        message: nomeError,
      },
      { status: 400 }
    );
  }

  const descricaoError = validarDescricao(description);

  if (descricaoError) {
    return NextResponse.json(
      {
        ok: false,
        message: descricaoError,
      },
      { status: 400 }
    );
  }

  const precoError = validarPreco(price);

  if (precoError) {
    return NextResponse.json(
      {
        ok: false,
        message: precoError,
      },
      { status: 400 }
    );
  }

  const ordemError = validarDisplayOrder(displayOrder);

  if (ordemError) {
    return NextResponse.json(
      {
        ok: false,
        message: ordemError,
      },
      { status: 400 }
    );
  }

  if (typeof isPublished !== "boolean") {
    return NextResponse.json(
      {
        ok: false,
        message: "O campo is_published é inválido.",
      },
      { status: 400 }
    );
  }

  if (catalogItemId) {
    const catalogError = await validarCatalogItem(
      auth.supabaseAdmin,
      auth.organization.id,
      catalogItemId
    );

    if (catalogError) {
      return NextResponse.json(
        {
          ok: false,
          message: catalogError,
        },
        { status: 400 }
      );
    }
  }

  const { data, error } = await auth.supabaseAdmin
    .from("vitrine_services")
    .insert({
      organization_id: auth.organization.id,
      catalog_item_id: catalogItemId,
      name,
      description,
      price,
      is_published: isPublished,
      display_order: displayOrder,
    })
    .select(
      "id,organization_id,catalog_item_id,name,description,price,is_published,display_order,created_at,updated_at"
    )
    .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível criar o serviço.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Serviço criado com sucesso.",
      service: data,
    },
    { status: 201 }
  );
}

export async function PATCH(request: Request) {
  const auth = await autenticarOwner(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!auth.permissions.services.manage) return NextResponse.json({ ok: false, message: "O proprietário ainda não liberou alterações no catálogo de serviços para sua conta." }, { status: 403 });

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "JSON inválido.",
      },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      {
        ok: false,
        message: "Dados inválidos.",
      },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;

  const id =
    typeof payload.id === "string"
      ? payload.id.trim()
      : "";

  if (!id) {
    return NextResponse.json(
      {
        ok: false,
        message: "Informe o ID do serviço.",
      },
      { status: 400 }
    );
  }

  const { data: existingService, error: existingError } =
    await auth.supabaseAdmin
      .from("vitrine_services")
      .select(
        "id,catalog_item_id,name,description,price,is_published,display_order"
      )
      .eq("id", id)
      .eq("organization_id", auth.organization.id)
      .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível localizar o serviço.",
      },
      { status: 500 }
    );
  }

  if (!existingService) {
    return NextResponse.json(
      {
        ok: false,
        message: "Serviço não encontrado.",
      },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = {};

  if ("name" in payload) {
    const name =
      typeof payload.name === "string"
        ? payload.name.trim()
        : "";

    const nomeError = validarNome(name);

    if (nomeError) {
      return NextResponse.json(
        {
          ok: false,
          message: nomeError,
        },
        { status: 400 }
      );
    }

    updates.name = name;
  }

  if ("description" in payload) {
    const description =
      typeof payload.description === "string"
        ? payload.description.trim() || null
        : payload.description === null
          ? null
          : payload.description;

    const descricaoError = validarDescricao(description);

    if (descricaoError) {
      return NextResponse.json(
        {
          ok: false,
          message: descricaoError,
        },
        { status: 400 }
      );
    }

    updates.description = description;
  }

  if ("price" in payload) {
    const price =
      payload.price === null ||
      payload.price === undefined ||
      payload.price === ""
        ? null
        : typeof payload.price === "string"
          ? Number(payload.price.replace(",", "."))
          : payload.price;

    const precoError = validarPreco(price);

    if (precoError) {
      return NextResponse.json(
        {
          ok: false,
          message: precoError,
        },
        { status: 400 }
      );
    }

    updates.price = price;
  }

  if ("display_order" in payload) {
    const displayOrder =
      payload.display_order === null ||
      payload.display_order === undefined ||
      payload.display_order === ""
        ? 0
        : Number(payload.display_order);

    const ordemError = validarDisplayOrder(displayOrder);

    if (ordemError) {
      return NextResponse.json(
        {
          ok: false,
          message: ordemError,
        },
        { status: 400 }
      );
    }

    updates.display_order = displayOrder;
  }

  if ("is_published" in payload) {
    if (typeof payload.is_published !== "boolean") {
      return NextResponse.json(
        {
          ok: false,
          message: "O campo is_published é inválido.",
        },
        { status: 400 }
      );
    }

    updates.is_published = payload.is_published;
  }

  if ("catalog_item_id" in payload) {
    const catalogItemId =
      typeof payload.catalog_item_id === "string" &&
      payload.catalog_item_id.trim()
        ? payload.catalog_item_id.trim()
        : null;

    if (catalogItemId) {
      const catalogError = await validarCatalogItem(
        auth.supabaseAdmin,
        auth.organization.id,
        catalogItemId
      );

      if (catalogError) {
        return NextResponse.json(
          {
            ok: false,
            message: catalogError,
          },
          { status: 400 }
        );
      }
    }

    updates.catalog_item_id = catalogItemId;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "Nenhuma alteração foi informada.",
      },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabaseAdmin
    .from("vitrine_services")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", auth.organization.id)
    .select(
      "id,organization_id,catalog_item_id,name,description,price,is_published,display_order,created_at,updated_at"
    )
    .single();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível atualizar o serviço.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Serviço atualizado com sucesso.",
    service: data,
  });
}

export async function DELETE(request: Request) {
  const auth = await autenticarOwner(request);

  if ("error" in auth) {
    return auth.error;
  }

  if (!auth.permissions.services.manage) return NextResponse.json({ ok: false, message: "O proprietário ainda não liberou alterações no catálogo de serviços para sua conta." }, { status: 403 });

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "JSON inválido.",
      },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      {
        ok: false,
        message: "Dados inválidos.",
      },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;

  const id =
    typeof payload.id === "string"
      ? payload.id.trim()
      : "";

  if (!id) {
    return NextResponse.json(
      {
        ok: false,
        message: "Informe o ID do serviço.",
      },
      { status: 400 }
    );
  }

  const { data, error } = await auth.supabaseAdmin
    .from("vitrine_services")
    .delete()
    .eq("id", id)
    .eq("organization_id", auth.organization.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível excluir o serviço.",
      },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        ok: false,
        message: "Serviço não encontrado.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Serviço excluído com sucesso.",
  });
}
