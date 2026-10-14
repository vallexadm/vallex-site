import { createClient } from "@supabase/supabase-js";

export type PublicProviderService = {
  id: string;
  name: string;
  description: string | null;
  price: number | string | null;
  is_published: boolean;
};

export type PublicProvider = {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  address: string | null;
  service_area: string | null;
  service_modes: string[];
  logo_url: string | null;
  is_published: boolean;
  is_preview: boolean;
  services: PublicProviderService[];
};

export async function loadPublicProviders(): Promise<PublicProvider[]> {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    console.error("Configuração do servidor indisponível para carregar prestadores.");
    return [];
  }

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profiles, error: profilesError } = await admin
    .from("organization_public_profiles")
    .select("id,organization_id,slug,display_name,description,address,service_area,service_modes,logo_url,is_published")
    .eq("is_published", true)
    .order("display_name", { ascending: true });

  if (profilesError) {
    console.error("Erro ao carregar prestadores para a página:", profilesError);
    return [];
  }
  if (!profiles?.length) return [];

  const organizationIds = profiles.map((profile) => profile.organization_id);
  const { data: services, error: servicesError } = await admin
    .from("vitrine_services")
    .select("id,organization_id,name,description,price,display_order,is_published")
    .in("organization_id", organizationIds)
    .eq("is_published", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (servicesError) {
    console.error("Erro ao carregar serviços para a página:", servicesError);
    return [];
  }

  return profiles.map((profile) => ({
    ...profile,
    is_preview: false,
    services: (services ?? []).filter((service) => service.organization_id === profile.organization_id),
  }));
}
