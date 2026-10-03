import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      message,
    },
    { status }
  );
}

async function getAuthenticatedContext(request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const authAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseSecretKey || !authUrl || !authAnonKey) {
    return {
      error: errorResponse(
        "Configuração do servidor incompleta.",
        500
      ),
    };
  }

  const authorization = request.headers.get("authorization");

  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!accessToken) {
    return {
      error: errorResponse("Autenticação necessária.", 401),
    };
  }

  const authClient = createClient(authUrl, authAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  const {
    data: authData,
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return {
      error: errorResponse(
        "Sessão inválida ou expirada.",
        401
      ),
    };
  }

  const userId = authData.user.id;

  const {
    data: ownedOrganization,
    error: ownerError,
  } = await supabaseAdmin
    .from("organizations")
    .select("id, name, owner_id")
    .eq("owner_id", userId)
    .maybeSingle();

  if (ownerError) {
    console.error(
      "Erro ao consultar organização do proprietário:",
      ownerError
    );

    return {
      error: errorResponse(
        "Não foi possível consultar a organização.",
        500
      ),
    };
  }

  if (ownedOrganization) {
    return {
      supabaseAdmin,
      userId,
      organization: ownedOrganization,
      role: "owner" as const,
    };
  }

  const {
    data: membership,
    error: membershipError,
  } = await supabaseAdmin
    .from("organization_members")
    .select(
      `
        organization_id,
        role,
        organizations (
          id,
          name,
          owner_id
        )
      `
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    console.error(
      "Erro ao consultar associação do usuário:",
      membershipError
    );

    return {
      error: errorResponse(
        "Não foi possível consultar sua organização.",
        500
      ),
    };
  }

  if (!membership || !membership.organizations) {
    return {
      error: errorResponse(
        "Sua conta não está vinculada a uma organização.",
        403
      ),
    };
  }

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  return {
    supabaseAdmin,
    userId,
    organization,
    role: "member" as const,
  };
}

export async function GET(request: NextRequest) {
  try {
    const context = await getAuthenticatedContext(request);

    if ("error" in context && context.error) {
      return context.error;
    }

    const {
      supabaseAdmin,
      organization,
      role,
    } = context;

    const { data: customers, error } = await supabaseAdmin
      .from("customers")
      .select(
        "id, organization_id, name, phone, email, address, notes, created_at, updated_at"
      )
      .eq("organization_id", organization.id)
      .order("name", { ascending: true });

    if (error) {
      console.error("Erro ao consultar clientes:", error);

      return errorResponse(
        "Não foi possível carregar os clientes.",
        500
      );
    }

    return NextResponse.json({
      ok: true,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      role,
      customers: customers ?? [],
    });
  } catch (error) {
    console.error("Erro na API GET de clientes:", error);

    return errorResponse(
      "Ocorreu um erro ao carregar os clientes.",
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAuthenticatedContext(request);

    if ("error" in context && context.error) {
      return context.error;
    }

    const {
      supabaseAdmin,
      organization,
      role,
    } = context;

    if (role !== "owner") {
      return errorResponse(
        "Somente o proprietário pode cadastrar clientes.",
        403
      );
    }

    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const address = String(body.address ?? "").trim();
    const notes = String(body.notes ?? "").trim();

    if (!name) {
      return errorResponse(
        "Informe o nome do cliente.",
        400
      );
    }

    if (
      name.length > 150 ||
      phone.length > 40 ||
      email.length > 150 ||
      address.length > 300 ||
      notes.length > 2000
    ) {
      return errorResponse(
        "Um ou mais campos excedem o tamanho permitido.",
        400
      );
    }

    const { data: customer, error } = await supabaseAdmin
      .from("customers")
      .insert({
        organization_id: organization.id,
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
      })
      .select(
        "id, organization_id, name, phone, email, address, notes, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("Erro ao cadastrar cliente:", error);

      return errorResponse(
        "Não foi possível cadastrar o cliente.",
        500
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Cliente cadastrado com sucesso.",
        customer,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro na API POST de clientes:", error);

    return errorResponse(
      "Ocorreu um erro ao cadastrar o cliente.",
      500
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAuthenticatedContext(request);

    if ("error" in context && context.error) {
      return context.error;
    }

    const {
      supabaseAdmin,
      organization,
      role,
    } = context;

    if (role !== "owner") {
      return errorResponse(
        "Somente o proprietário pode alterar clientes.",
        403
      );
    }

    const body = await request.json();

    const id = String(body.id ?? "").trim();
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const address = String(body.address ?? "").trim();
    const notes = String(body.notes ?? "").trim();

    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      return errorResponse(
        "Identificador do cliente inválido.",
        400
      );
    }

    if (!name) {
      return errorResponse(
        "Informe o nome do cliente.",
        400
      );
    }

    const { data: customer, error } = await supabaseAdmin
      .from("customers")
      .update({
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", organization.id)
      .select(
        "id, organization_id, name, phone, email, address, notes, created_at, updated_at"
      )
      .maybeSingle();

    if (error) {
      console.error("Erro ao atualizar cliente:", error);

      return errorResponse(
        "Não foi possível atualizar o cliente.",
        500
      );
    }

    if (!customer) {
      return errorResponse(
        "Cliente não encontrado.",
        404
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Cliente atualizado com sucesso.",
      customer,
    });
  } catch (error) {
    console.error("Erro na API PATCH de clientes:", error);

    return errorResponse(
      "Ocorreu um erro ao atualizar o cliente.",
      500
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAuthenticatedContext(request);

    if ("error" in context && context.error) {
      return context.error;
    }

    const {
      supabaseAdmin,
      organization,
      role,
    } = context;

    if (role !== "owner") {
      return errorResponse(
        "Somente o proprietário pode excluir clientes.",
        403
      );
    }

    const body = await request.json();

    const id = String(body.id ?? "").trim();

    if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      return errorResponse(
        "Identificador do cliente inválido.",
        400
      );
    }

    const { data: customer, error } = await supabaseAdmin
      .from("customers")
      .delete()
      .eq("id", id)
      .eq("organization_id", organization.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Erro ao excluir cliente:", error);

      return errorResponse(
        "Não foi possível excluir o cliente.",
        500
      );
    }

    if (!customer) {
      return errorResponse(
        "Cliente não encontrado.",
        404
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Cliente excluído com sucesso.",
    });
  } catch (error) {
    console.error("Erro na API DELETE de clientes:", error);

    return errorResponse(
      "Ocorreu um erro ao excluir o cliente.",
      500
    );
  }
}