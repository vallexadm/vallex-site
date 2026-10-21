import type { SupabaseClient } from "@supabase/supabase-js";

export async function hasMemberAffiliation(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin.from("organization_members")
    .select("organization_id").eq("user_id", userId).eq("role", "member").limit(1);
  if (error) throw new Error("Não foi possível verificar o vínculo de colaborador.");
  return Boolean(data?.length);
}
