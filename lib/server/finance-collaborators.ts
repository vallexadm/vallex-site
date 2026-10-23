import type { SupabaseClient } from "@supabase/supabase-js";

export async function getFinanceCollaborators(admin: SupabaseClient, organizationId: string) {
  const [membersResult, namesResult] = await Promise.all([
    admin.from("organization_members").select("user_id").eq("organization_id", organizationId).eq("role", "member"),
    admin.from("organization_invitations").select("accepted_by, invitee_name").eq("organization_id", organizationId)
      .eq("status", "accepted").order("accepted_at", { ascending: false }),
  ]);
  if (membersResult.error || namesResult.error) throw new Error("Não foi possível consultar os colaboradores do negócio.");
  const names = new Map<string, string>();
  for (const invitation of namesResult.data ?? []) {
    if (invitation.accepted_by && !names.has(invitation.accepted_by) && invitation.invitee_name?.trim()) {
      names.set(invitation.accepted_by, invitation.invitee_name.trim());
    }
  }
  return (membersResult.data ?? []).map((member) => ({
    id: String(member.user_id), name: names.get(member.user_id) ?? `Colaborador ${String(member.user_id).slice(0, 8)}`,
  })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
