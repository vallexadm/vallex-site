import {createHash,randomBytes} from "node:crypto";
import {NextResponse} from "next/server";
import {providerContext,proFail} from "@/lib/server/provider-context";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const c=await providerContext(request);if("error" in c)return c.error;if(c.role!=="owner")return proFail("Apenas o proprietário pode enviar a proposta.",403);
 const {id}=await params;const r=await c.admin.from("orcamentos").select("id,updated_at,status,validade_ate").eq("id",id).eq("organization_id",c.organization.id).maybeSingle();
 if(r.error||!r.data)return proFail("Proposta não encontrada.",404);if(!["rascunho","enviado"].includes(r.data.status))return proFail("Esta proposta já foi encerrada.",409);
 const token=randomBytes(32).toString("hex"),expires=new Date(Date.now()+7*86400000).toISOString();
 const saved=await c.admin.from("quote_decision_links").insert({token_hash:createHash("sha256").update(token).digest("hex"),quote_id:id,organization_id:c.organization.id,quote_version:r.data.updated_at,expires_at:expires});
 if(saved.error)return proFail("Não foi possível preparar o link.",503);
 return NextResponse.json({ok:true,url:`${new URL(request.url).origin}/proposta#token=${token}`},{headers:{"Cache-Control":"no-store"}});
 }catch{return proFail("Não foi possível preparar a proposta.",503);}
}
