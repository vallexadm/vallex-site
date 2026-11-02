import { randomBytes,randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { providerContext,proFail } from "@/lib/server/provider-context";
import { generateQuotePdf } from "@/lib/quote-pdf";
export const runtime="nodejs";
async function build(request:Request,id:string){
  const c=await providerContext(request);if("error" in c)return {error:c.error};
  if(c.role!=="owner"||!c.permissions.quotes.view)return {error:proFail("Somente o proprietário pode compartilhar esta proposta.",403)};
  if(!c.plan.canGenerateQuotePdf)return {error:proFail("Orçamentos em PDF estão disponíveis no Professional.",403)};
  const {data:q,error}=await c.admin.from("orcamentos").select("id,titulo,descricao,valor,validade_ate,observacoes,status,customers(name)").eq("id",id).eq("organization_id",c.organization.id).maybeSingle();
  if(error||!q)return {error:proFail("Orçamento não encontrado nesta organização.",404)};
  const {data:f,error:profileError}=await c.admin.from("provider_fiscal_profiles").select("legal_name,tax_id,address,email,phone").eq("organization_id",c.organization.id).maybeSingle();
  if(profileError)return {error:proFail("Não foi possível consultar a identificação do prestador.",503)};
  const customer=Array.isArray(q.customers)?q.customers[0]:q.customers;
  const bytes=await generateQuotePdf({provider:{name:f?.legal_name||c.organization.name,taxId:f?.tax_id,address:f?.address,email:f?.email,phone:f?.phone},customer:customer?.name||"Cliente",title:q.titulo,description:q.descricao,amount:Number(q.valor),validUntil:q.validade_ate,notes:q.observacoes,status:q.status});
  return {c,bytes};
}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{const {id}=await params,result=await build(request,id);if("error" in result)return result.error;
    return new Response(Buffer.from(result.bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="orcamento-${id.replace(/[^a-f0-9-]/gi,'')}.pdf"`,"Cache-Control":"private, no-store"}});
  }catch{return proFail("Não foi possível gerar o PDF.",500);}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{const {id}=await params,result=await build(request,id);if("error" in result)return result.error;
    const {c,bytes}=result,path=`${c.organization.id}/${id}/proposta-${randomUUID()}.pdf`,bucket=c.admin.storage.from("vallex-orcamentos");
    const upload=await bucket.upload(path,bytes,{contentType:"application/pdf",upsert:false});if(upload.error)return proFail("Não foi possível guardar o PDF para compartilhamento.",503);
    const token=randomBytes(12).toString("base64url"),expiresAt=new Date(Date.now()+7*86400000).toISOString();
    const saved=await c.admin.from("quote_file_links").insert({token,organization_id:c.organization.id,quote_id:id,storage_path:path,download_name:"orcamento.pdf",expires_at:expiresAt});
    if(saved.error){await bucket.remove([path]);return proFail("Não foi possível criar o link do PDF.",503);}
    return NextResponse.json({ok:true,url:`${new URL(request.url).origin}/a/${token}`,expiresAt},{headers:{"Cache-Control":"no-store"}});
  }catch{return proFail("Não foi possível preparar o PDF.",500);}
}
