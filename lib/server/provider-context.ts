import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hasMemberAffiliation } from "@/lib/server/member-affiliation";
import { getPlanEntitlements } from "@/lib/server/plan-entitlements";
import { normalizeMemberPermissions, ownerPermissions } from "@/lib/team-permissions";
export function providerAdmin() {
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
  if (!url||!key) throw new Error("Configuração do servidor incompleta.");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export const proFail=(message:string,status=400)=>NextResponse.json({ok:false,message},{status,headers:{"Cache-Control":"no-store"}});
export async function providerContext(request:Request) {
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim();
  if(!token) return {error:proFail("Entre na sua conta.",401)};
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key) return {error:proFail("Autenticação indisponível.",503)};
  const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await auth.auth.getUser(token);
  if(error||!data.user) return {error:proFail("Sessão inválida ou expirada.",401)};
  const admin=providerAdmin(),user=data.user;
  const {data:owned,error:ownedError}=await admin.from("organizations").select("id,name,owner_id").eq("owner_id",user.id).maybeSingle();
  if(ownedError) return {error:proFail("Não foi possível consultar a organização.",503)};
  let organization=owned,permissions=ownerPermissions,role="owner";
  if(!owned||await hasMemberAffiliation(admin,user.id)) {
    const {data:member,error:memberError}=await admin.from("organization_members").select("organization_id,role,permissions").eq("user_id",user.id).eq("is_active",true).maybeSingle();
    if(memberError) return {error:proFail("Não foi possível conferir a equipe.",503)};
    if(!member) return {error:proFail("Configure sua organização ou entre com uma conta autorizada.",403)};
    const result=await admin.from("organizations").select("id,name,owner_id").eq("id",member.organization_id).maybeSingle();
    if(result.error||!result.data) return {error:proFail("Organização indisponível.",403)};
    organization=result.data;permissions=normalizeMemberPermissions(member.permissions);role="member";
  }
  const plan=await getPlanEntitlements(admin,organization!.id);
  if(!plan.entitlements) return {error:proFail(plan.error,503)};
  return {admin,user,organization:organization!,permissions,role,plan:plan.entitlements};
}
