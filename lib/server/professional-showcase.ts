import {providerAdmin} from "@/lib/server/provider-context";
import {getPlanEntitlements} from "@/lib/server/plan-entitlements";
export async function professionalShowcase(slug:string){
 const admin=providerAdmin();const result=await admin.from("organization_public_profiles").select("organization_id,display_name,slug").eq("slug",slug).eq("is_published",true).maybeSingle();
 if(result.error)throw Error("Não foi possível consultar a Vitrine.");if(!result.data)return null;
 const plan=await getPlanEntitlements(admin,result.data.organization_id);if(!plan.entitlements)throw Error(plan.error);
 if(!plan.entitlements.canPublishPortfolio)return null;return {admin,profile:result.data};
}
