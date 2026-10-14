import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Organization = {
  id: string;
  name: string;
  owner_id: string;
};

type AuthenticatedOwnerContext = {
  supabaseAdmin: SupabaseClient;
  userId: string;
  organization: Organization;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      message,
    },
    { status }
  );
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function validateSlug(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const slug = value.trim().toLowerCase();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return null;
  }

  if (slug.length < 3 || slug.length > 80) {
    return null;
  }

  return slug;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidBrazilianPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return /^[\d\s()+-]+$/.test(value) && (digits.length === 10 || digits.length === 11);
}

function validateLength(
  value: string | null,
  fieldName: string,
  maxLength: number
): string | null {
  if (value !== null && value.length > maxLength) {
    return `${fieldName} deve ter no máximo ${maxLength} caracteres.`;
  }

  return null;
}

async function getAuthenticatedOwnerContext(
  request: Request
): Promise<
  | {
      error: NextResponse;
    }
  | AuthenticatedOwnerContext
> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !supabaseUrl ||
    !supabaseSecretKey ||
    !publicSupabaseUrl ||
    !publicAnonKey
  ) {
    return {
      error: errorResponse(
        "Configuração do Supabase não encontrada no servidor.",
        500
      ),
    };
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: errorResponse("Autenticação necessária.", 401),
    };
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return {
      error: errorResponse("Token de autenticação não informado.", 401),
    };
  }

  const authClient = createClient(publicSupabaseUrl, publicAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return {
      error: errorResponse("Sessão inválida ou expirada.", 401),
    };
  }

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

  const { data: organization, error: organizationError } =
    await supabaseAdmin
      .from("organizations")
      .select("id, name, owner_id")
      .eq("owner_id", user.id)
      .maybeSingle();

  if (organizationError) {
    console.error(
      "Erro ao localizar organização do proprietário:",
      organizationError
    );

    return {
      error: errorResponse(
        "Não foi possível identificar a organização.",
        500
      ),
    };
  }

  if (!organization) {
    return {
      error: errorResponse(
        "Somente o proprietário da organização pode configurar a Vitrine.",
        403
      ),
    };
  }

  return {
    supabaseAdmin,
    userId: user.id,
    organization,
  };
}

function validateProfilePayload(body: Record<string, unknown>) {
  const displayName = normalizeOptionalString(body.display_name);
  const description = normalizeOptionalString(body.description);
  const phone = normalizeOptionalString(body.phone);
  const whatsapp = normalizeOptionalString(body.whatsapp);
  const email = normalizeOptionalString(body.email);
  const address = normalizeOptionalString(body.address);
  const serviceArea = normalizeOptionalString(body.service_area);
  const allowedServiceModes = ["presencial", "domicilio", "online"] as const;
  const serviceModesValue = body.service_modes;
  const serviceModes = Array.isArray(serviceModesValue)
    ? [...new Set(serviceModesValue.filter((mode): mode is (typeof allowedServiceModes)[number] =>
        typeof mode === "string" && allowedServiceModes.includes(mode as (typeof allowedServiceModes)[number])
      ))]
    : [];
  const logoUrl = normalizeOptionalString(body.logo_url);

  let slug = validateSlug(body.slug);

  if (!slug && displayName) {
    slug = slugify(displayName);
  }

  if (!slug) {
    return {
      error: "Informe um slug válido para a Vitrine.",
    };
  }

  if (!displayName) {
    return {
      error: "Informe o nome que será exibido na Vitrine.",
    };
  }

  if (displayName.length < 2 || displayName.length > 160) {
    return {
      error: "O nome da Vitrine deve ter entre 2 e 160 caracteres.",
    };
  }

  if (email && (email.length > 254 || !isValidEmail(email))) {
    return {
      error: "Informe um e-mail válido.",
    };
  }

  if (phone && !isValidBrazilianPhone(phone)) {
    return {
      error: "Informe um telefone válido com DDD, usando 10 ou 11 números.",
    };
  }

  if (!whatsapp || !isValidBrazilianPhone(whatsapp)) {
    return {
      error: "Informe um WhatsApp válido com DDD, usando 10 ou 11 números.",
    };
  }

  const lengthChecks = [
    validateLength(description, "A descrição", 2000),
    validateLength(phone, "O telefone", 15),
    validateLength(whatsapp, "O WhatsApp", 15),
    validateLength(email, "O e-mail", 254),
    validateLength(address, "O endereço", 500),
    validateLength(serviceArea, "A cidade ou região de atendimento", 300),
    validateLength(logoUrl, "A URL do logotipo", 2048),
  ];

  const lengthError = lengthChecks.find(
  (error): error is string => Boolean(error)
);

if (lengthError) {
  return {
    error: lengthError,
  };
}

  return {
    data: {
      slug,
      display_name: displayName,
      description,
      phone,
      whatsapp,
      email,
      address,
      service_area: serviceArea,
      service_modes: serviceModes,
      logo_url: logoUrl,
    },
  };
}

/**
 * GET
 *
 * Retorna a configuração atual da Vitrine da organização.
 */
export async function GET(request: Request) {
  const context = await getAuthenticatedOwnerContext(request);

  if ("error" in context) {
    return context.error;
  }

  const { supabaseAdmin, organization } = context;

  const { data: profile, error } = await supabaseAdmin
    .from("organization_public_profiles")
    .select(
      `
        id,
        organization_id,
        slug,
        display_name,
        description,
        phone,
        whatsapp,
        email,
        address,
        service_area,
        service_modes,
        logo_url,
        is_published,
        publication_authorized_at,
        publication_revoked_at,
        created_at,
        updated_at
      `
    )
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar perfil público:", error);

    return errorResponse(
      "Não foi possível carregar a configuração da Vitrine.",
      500
    );
  }

  return NextResponse.json({
    ok: true,
    organization: {
      id: organization.id,
      name: organization.name,
    },
    profile: profile ?? null,
  });
}

/**
 * POST
 *
 * Cria a configuração da Vitrine.
 *
 * A criação NÃO publica automaticamente.
 * A publicação será uma ação explícita posterior.
 */
export async function POST(request: Request) {
  const context = await getAuthenticatedOwnerContext(request);

  if ("error" in context) {
    return context.error;
  }

  const { supabaseAdmin, organization } = context;

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Corpo da requisição inválido.", 400);
  }

  const validation = validateProfilePayload(body);

  if ("error" in validation) {
    return errorResponse(
  validation.error ?? "Dados inválidos.",
  400
);
  }

  const { data: existingProfile, error: existingError } =
    await supabaseAdmin
      .from("organization_public_profiles")
      .select("id")
      .eq("organization_id", organization.id)
      .maybeSingle();

  if (existingError) {
    console.error(
      "Erro ao verificar perfil público existente:",
      existingError
    );

    return errorResponse(
      "Não foi possível verificar a Vitrine existente.",
      500
    );
  }

  if (existingProfile) {
    return errorResponse(
      "A Vitrine desta organização já foi configurada.",
      409
    );
  }

  const { data: profile, error } = await supabaseAdmin
  .from("organization_public_profiles")
  .insert({
    organization_id: organization.id,
    ...validation.data,
    is_published: false,
    publication_authorized_at: null,
    publication_revoked_at: null,
  })
  .select(`
    id,
    organization_id,
    slug,
    display_name,
    description,
    phone,
    whatsapp,
    email,
    address,
    service_area,
    service_modes,
    logo_url,
    is_published,
    publication_authorized_at,
    publication_revoked_at,
    created_at,
    updated_at
  `)
  .single();

  if (error) {
    console.error("Erro ao criar perfil público:", error);

    if (error.code === "23505") {
      return errorResponse(
        "O endereço público informado já está sendo utilizado.",
        409
      );
    }

    return errorResponse(
      "Não foi possível criar a configuração da Vitrine.",
      500
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Configuração da Vitrine criada com sucesso.",
      profile,
    },
    { status: 201 }
  );
}

/**
 * PATCH
 *
 * Atualiza os dados da Vitrine.
 *
 * action:
 * - "publish" -> publica
 * - "revoke"  -> revoga a publicação
 *
 * Sem action, apenas os dados cadastrais são atualizados.
 */
export async function PATCH(request: Request) {
  const context = await getAuthenticatedOwnerContext(request);

  if ("error" in context) {
    return context.error;
  }

  const { supabaseAdmin, userId, organization } = context;

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Corpo da requisição inválido.", 400);
  }

  const action =
    body.action === undefined || body.action === null
      ? null
      : body.action;

  if (
    action !== null &&
    action !== "publish" &&
    action !== "revoke"
  ) {
    return errorResponse(
      'A ação deve ser "publish" ou "revoke".',
      400
    );
  }

  const { data: currentProfile, error: currentError } =
    await supabaseAdmin
      .from("organization_public_profiles")
      .select(
        `
          id,
          organization_id,
          slug,
          display_name,
          description,
          phone,
          whatsapp,
          email,
          address,
          service_area,
          service_modes,
          logo_url,
          is_published,
          publication_authorized_at,
          publication_revoked_at,
          created_at,
          updated_at
        `
      )
      .eq("organization_id", organization.id)
      .maybeSingle();

  if (currentError) {
    console.error(
      "Erro ao buscar configuração atual da Vitrine:",
      currentError
    );

    return errorResponse(
      "Não foi possível carregar a configuração atual da Vitrine.",
      500
    );
  }

  if (!currentProfile) {
    return errorResponse(
      "A Vitrine ainda não foi configurada.",
      404
    );
  }

  const validation = validateProfilePayload(body);

  if ("error" in validation) {
    return errorResponse(
  validation.error ?? "Dados inválidos.",
  400
);
  }

  if (action === "publish") {
    if (!validation.data.service_area) {
      return errorResponse(
        "Informe a cidade ou região atendida antes de publicar sua Vitrine.",
        400
      );
    }
    if (validation.data.service_modes.length === 0) {
      return errorResponse(
        "Selecione pelo menos uma forma de atendimento antes de publicar sua Vitrine.",
        400
      );
    }
  }

  const profileData = {
    ...validation.data,
    updated_at: new Date().toISOString(),
  };

  /*
   * Atualização simples dos dados, sem alterar publicação.
   */
  if (action === null) {
    const { data: profile, error } = await supabaseAdmin
      .from("organization_public_profiles")
      .update(profileData)
      .eq("id", currentProfile.id)
      .eq("organization_id", organization.id)
      .select(
        `
          id,
          organization_id,
          slug,
          display_name,
          description,
          phone,
          whatsapp,
          email,
          address,
          service_area,
          service_modes,
          logo_url,
          is_published,
          publication_authorized_at,
          publication_revoked_at,
          created_at,
          updated_at
        `
      )
      .single();

    if (error) {
      console.error(
        "Erro ao atualizar perfil público:",
        error
      );

      if (error.code === "23505") {
        return errorResponse(
          "O endereço público informado já está sendo utilizado.",
          409
        );
      }

      return errorResponse(
        "Não foi possível atualizar a configuração da Vitrine.",
        500
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Configuração da Vitrine atualizada com sucesso.",
      profile,
    });
  }

  /*
   * PUBLICAÇÃO
   */
  if (action === "publish") {
    const now = new Date().toISOString();

    const alreadyPublished = currentProfile.is_published === true;

    const publicationData = {
      ...profileData,
      is_published: true,
      publication_authorized_at:
        currentProfile.publication_authorized_at ?? now,
      publication_revoked_at: null,
    };

    /*
     * Se já estiver publicada, apenas atualizamos os dados.
     * Não criamos um novo histórico desnecessariamente.
     */
    if (alreadyPublished) {
      const { data: profile, error } = await supabaseAdmin
        .from("organization_public_profiles")
        .update(publicationData)
        .eq("id", currentProfile.id)
        .eq("organization_id", organization.id)
        .select(
          `
            id,
            organization_id,
            slug,
            display_name,
            description,
            phone,
            whatsapp,
            email,
            address,
            service_area,
            service_modes,
            logo_url,
            is_published,
            publication_authorized_at,
            publication_revoked_at,
            created_at,
            updated_at
          `
        )
        .single();

      if (error) {
        console.error(
          "Erro ao atualizar Vitrine publicada:",
          error
        );

        if (error.code === "23505") {
          return errorResponse(
            "O endereço público informado já está sendo utilizado.",
            409
          );
        }

        return errorResponse(
          "Não foi possível atualizar a Vitrine.",
          500
        );
      }

      return NextResponse.json({
        ok: true,
        message: "Vitrine atualizada.",
        profile,
      });
    }

    /*
     * Primeiro atualizamos a configuração.
     */
    const { data: profile, error: updateError } =
      await supabaseAdmin
        .from("organization_public_profiles")
        .update(publicationData)
        .eq("id", currentProfile.id)
        .eq("organization_id", organization.id)
        .select(
          `
            id,
            organization_id,
            slug,
            display_name,
            description,
            phone,
            whatsapp,
            email,
            address,
            service_area,
            service_modes,
            logo_url,
            is_published,
            publication_authorized_at,
            publication_revoked_at,
            created_at,
            updated_at
          `
        )
        .single();

    if (updateError) {
      console.error(
        "Erro ao publicar Vitrine:",
        updateError
      );

      if (updateError.code === "23505") {
        return errorResponse(
          "O endereço público informado já está sendo utilizado.",
          409
        );
      }

      return errorResponse(
        "Não foi possível publicar a Vitrine.",
        500
      );
    }

    /*
     * Registra a autorização explícita.
     */
    const { error: historyError } = await supabaseAdmin
      .from("organization_publication_history")
      .insert({
        organization_id: organization.id,
        action: "authorized",
        actor_user_id: userId,
        metadata: {
          source: "sistema_vitrine",
        },
      });

    if (historyError) {
      console.error(
        "Erro ao registrar histórico de publicação:",
        historyError
      );

      /*
       * Tentativa de rollback para evitar manter publicada
       * uma Vitrine sem o respectivo registro de autorização.
       */
      await supabaseAdmin
        .from("organization_public_profiles")
        .update({
          is_published: currentProfile.is_published,
          publication_authorized_at:
            currentProfile.publication_authorized_at,
          publication_revoked_at:
            currentProfile.publication_revoked_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentProfile.id)
        .eq("organization_id", organization.id);

      return errorResponse(
        "Não foi possível registrar a autorização da publicação.",
        500
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Vitrine publicada com sucesso.",
      profile,
    });
  }

  /*
   * REVOGAÇÃO DA PUBLICAÇÃO
   */
  if (action === "revoke") {
    const now = new Date().toISOString();

    const alreadyRevoked = currentProfile.is_published === false;

    const revokeData = {
      ...profileData,
      is_published: false,
      publication_revoked_at: now,
    };

    /*
     * Se já estiver despublicada, apenas atualizamos os dados.
     */
    if (alreadyRevoked) {
      const { data: profile, error } = await supabaseAdmin
        .from("organization_public_profiles")
        .update(revokeData)
        .eq("id", currentProfile.id)
        .eq("organization_id", organization.id)
        .select(
          `
            id,
            organization_id,
            slug,
            display_name,
            description,
            phone,
            whatsapp,
            email,
            address,
            service_area,
            service_modes,
            logo_url,
            is_published,
            publication_authorized_at,
            publication_revoked_at,
            created_at,
            updated_at
          `
        )
        .single();

      if (error) {
        console.error(
          "Erro ao atualizar Vitrine:",
          error
        );

        if (error.code === "23505") {
          return errorResponse(
            "O endereço público informado já está sendo utilizado.",
            409
          );
        }

        return errorResponse(
          "Não foi possível atualizar a Vitrine.",
          500
        );
      }

      return NextResponse.json({
        ok: true,
        message: "Vitrine permanece despublicada.",
        profile,
      });
    }

    /*
     * Revoga a publicação.
     */
    const { data: profile, error: updateError } =
      await supabaseAdmin
        .from("organization_public_profiles")
        .update(revokeData)
        .eq("id", currentProfile.id)
        .eq("organization_id", organization.id)
        .select(
          `
            id,
            organization_id,
            slug,
            display_name,
            description,
            phone,
            whatsapp,
            email,
            address,
            service_area,
            service_modes,
            logo_url,
            is_published,
            publication_authorized_at,
            publication_revoked_at,
            created_at,
            updated_at
          `
        )
        .single();

    if (updateError) {
      console.error(
        "Erro ao revogar publicação da Vitrine:",
        updateError
      );

      if (updateError.code === "23505") {
        return errorResponse(
          "O endereço público informado já está sendo utilizado.",
          409
        );
      }

      return errorResponse(
        "Não foi possível revogar a publicação da Vitrine.",
        500
      );
    }

    /*
     * Registra a revogação.
     */
    const { error: historyError } = await supabaseAdmin
      .from("organization_publication_history")
      .insert({
        organization_id: organization.id,
        action: "revoked",
        actor_user_id: userId,
        metadata: {
          source: "sistema_vitrine",
        },
      });

    if (historyError) {
      console.error(
        "Erro ao registrar histórico de revogação:",
        historyError
      );

      /*
       * Tentativa de rollback.
       */
      await supabaseAdmin
        .from("organization_public_profiles")
        .update({
          is_published: currentProfile.is_published,
          publication_authorized_at:
            currentProfile.publication_authorized_at,
          publication_revoked_at:
            currentProfile.publication_revoked_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentProfile.id)
        .eq("organization_id", organization.id);

      return errorResponse(
        "Não foi possível registrar a revogação da publicação.",
        500
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Publicação da Vitrine revogada com sucesso.",
      profile,
    });
  }

  return errorResponse("Ação não processada.", 400);
}
