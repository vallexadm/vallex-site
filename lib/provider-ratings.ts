import type { SupabaseClient } from "@supabase/supabase-js";

export type ProviderRating = { average: number; count: number };

export async function loadProviderRatings(admin: SupabaseClient, organizationIds: string[]) {
  const { data, error } = await admin.rpc("provider_rating_summaries", { organization_ids: organizationIds });
  if (error) {
    console.error("Erro ao carregar médias dos prestadores:", error);
    return null;
  }

  return new Map<string, ProviderRating>(
    (data ?? []).map((row: { organization_id: string; average: number; review_count: number }) => [
      row.organization_id,
      { average: Number(row.average), count: Number(row.review_count) },
    ]),
  );
}