import {createHash,randomBytes,randomUUID} from "node:crypto";
import sharp from "sharp";
import {NextResponse} from "next/server";
import {providerContext,proFail} from "@/lib/server/provider-context";
export const runtime="nodejs";
const uuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(v);
const noStore={"Cache-Control":"private, no-store"};
export async function GET(request:Request){
 try{
  const c=await providerContext(request);if("error" in c)return c.error;
  if(c.role!=="owner")return proFail("Esta Ã¡rea Ã© do proprietÃ¡rio.",403);
  if(!c.plan.canManageFiscalNotes)return NextResponse.json({ok:true,plan:c.plan,profile:null,photos:[],notes:[],reviews:[],appointments:[]},{headers:noStore});
  const results=await Promise.all([
   c.admin.from("provider_fiscal_profiles").select("*").eq("organization_id",c.organization.id).maybeSingle(),
   c.admin.from("provider_portfolio").select("id,caption,file_path,created_at").eq("organization_id",c.organization.id).order("created_at",{ascending:false}),
   c.admin.from("provider_fiscal_notes").select("*").eq("organization_id",c.organization.id).order("issued_on",{ascending:false}).limit(100),
   c.admin.from("provider_reviews").select("id,author_name,rating,comment,created_at").eq("organization_id",c.organization.id).order("created_at",{ascending:false}).limit(100),
   c.admin.from("organization_appointments").select("id,title,starts_at").eq("organization_id",c.organization.id).eq("status","completed").order("starts_at",{ascending:false}).limit(100)
  ]);
  if(results.some(r=>r.error))return proFail("NÃ£o foi possÃ­vel carregar os recursos. Confira a migraÃ§Ã£o do Professional no ambiente de teste.",503);
  const photos=await Promise.all((results[1].data||[]).map(async row=>{const link=await c.admin.storage.from("vallex-pro").createSignedUrl(row.file_path,600);return {...row,url:link.data?.signedUrl};}));
  const notes=await Promise.all((results[2].data||[]).map(async row=>{const link=await c.admin.storage.from("vallex-pro").createSignedUrl(row.file_path,600);return {...row,url:link.data?.signedUrl};}));
  return NextResponse.json({ok:true,plan:c.plan,profile:results[0].data,photos,notes,reviews:results[3].data,appointments:results[4].data},{headers:noStore});
 }catch{return proFail("NÃ£o foi possÃ­vel consultar os recursos profissionais.",500);}
}
export async function POST(request:Request){
 try{
  const c=await providerContext(request);if("error" in c)return c.error;
  if(c.role!=="owner")return proFail("Esta Ã¡rea Ã© do proprietÃ¡rio.",403);
  if(!c.plan.canManageFiscalNotes)return proFail("Este recurso estÃ¡ disponÃ­vel no Professional.",403);
  if(request.headers.get("content-type")?.includes("application/json")){
   const body=await request.json();
   if(body.action==="profile"){
    const limits:Record<string,number>={legal_name:160,tax_id:18,municipal_registration:40,city:100,state:2,address:300,email:150,phone:40};
    const row:Record<string,string>={organization_id:c.organization.id};
    for(const [key,max] of Object.entries(limits)){const value=String(body[key]??"").trim();if(value.length>max)return proFail(`Confira o campo ${key}.`);row[key]=value;}
    if(row.legal_name.length<2)return proFail("Informe o nome ou razÃ£o social do prestador.");
    const digits=row.tax_id.replace(/\D/g,"");if(digits&&!([11,14].includes(digits.length)))return proFail("Informe CPF ou CNPJ completo.");
    row.updated_at=new Date().toISOString();const result=await c.admin.from("provider_fiscal_profiles").upsert(row,{onConflict:"organization_id"});
    if(result.error)return proFail("NÃ£o foi possÃ­vel salvar a identificaÃ§Ã£o fiscal.",503);
    return NextResponse.json({ok:true,message:"IdentificaÃ§Ã£o do prestador salva."},{headers:noStore});
   }
   if(body.action==="review_invite"){
    if(!uuid(body.appointmentId))return proFail("Selecione um atendimento concluÃ­do.");
    const a=await c.admin.from("organization_appointments").select("id").eq("id",body.appointmentId).eq("organization_id",c.organization.id).eq("status","completed").maybeSingle();
    if(a.error||!a.data)return proFail("O atendimento deve estar concluÃ­do nesta organizaÃ§Ã£o.",404);
    const current=await c.admin.from("provider_review_invites").select("id,used_at").eq("appointment_id",a.data.id).eq("organization_id",c.organization.id).maybeSingle();
    if(current.error)return proFail("NÃ£o foi possÃ­vel consultar o convite.",503);
    if(current.data?.used_at)return proFail("Este atendimento jÃ¡ recebeu avaliaÃ§Ã£o.",409);
    const token=randomBytes(32).toString("hex"),row={organization_id:c.organization.id,appointment_id:a.data.id,token_hash:createHash("sha256").update(token).digest("hex"),expires_at:new Date(Date.now()+30*86400000).toISOString()};
    const saved=current.data?await c.admin.from("provider_review_invites").update(row).eq("id",current.data.id).is("used_at",null).select("id").maybeSingle():await c.admin.from("provider_review_invites").insert(row).select("id").single();
    if(saved.error||!saved.data)return proFail("O convite jÃ¡ foi alterado. Atualize e tente novamente.",409);
    return NextResponse.json({ok:true,url:`${new URL(request.url).origin}/avaliar-prestador#token=${token}`,message:"Convite pronto. Envie o link ao cliente. Gerar outro invalida o link anterior."},{headers:noStore});
   }
   return proFail("AÃ§Ã£o invÃ¡lida.");
  }
  const form=await request.formData(),purpose=form.get("purpose"),file=form.get("file");
  if(!(file instanceof File)||file.size<=0||file.size>4*1024*1024)return proFail("Selecione um arquivo de atÃ© 4 MB.");
  if(!["portfolio","note"].includes(String(purpose)))return proFail("Finalidade invÃ¡lida.");
  const id=randomUUID(),bytes=Buffer.from(await file.arrayBuffer());let content:Buffer=bytes,mime="application/pdf",path="";
  let record:Record<string,unknown>={id,organization_id:c.organization.id};
  if(purpose==="portfolio"){
   if(form.get("consent")!=="true")return proFail("Confirme que pode publicar esta imagem.");
   if(!["image/jpeg","image/png","image/webp"].includes(file.type))return proFail("Use JPG, PNG ou WebP.",415);
   const count=await c.admin.from("provider_portfolio").select("id",{count:"exact",head:true}).eq("organization_id",c.organization.id);
   if(count.error)return proFail("NÃ£o foi possÃ­vel conferir as fotos.",503);
   if((count.count||0)>=20)return proFail("Sua galeria pode ter atÃ© 20 fotos.",409);
   const caption=String(form.get("caption")||"").trim();if(caption.length<3||caption.length>160)return proFail("Informe uma legenda de 3 a 160 caracteres.");
   try{const image=sharp(bytes,{limitInputPixels:25000000});const meta=await image.metadata();if(!["jpeg","png","webp"].includes(meta.format||""))return proFail("Imagem invÃ¡lida.",415);content=await image.rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).webp({quality:82}).toBuffer();}catch{return proFail("NÃ£o foi possÃ­vel ler esta imagem.",415);}
   mime="image/webp";path=`${c.organization.id}/portfolio/${id}.webp`;record={...record,caption,file_path:path};
  }else{
   if(file.type!=="application/pdf"||bytes.toString("ascii",0,5)!=="%PDF-")return proFail("Anexe o PDF da nota jÃ¡ emitida no portal oficial.",415);
   const number=String(form.get("number")||"").trim(),issued=String(form.get("issued_on")||""),description=String(form.get("service_description")||"").trim(),amount=Number(form.get("amount")),key=String(form.get("verification_key")||"").trim();
   if(!number||number.length>60||!/^\d{4}-\d{2}-\d{2}$/.test(issued)||!Number.isFinite(Date.parse(issued))||new Date(issued).toISOString().slice(0,10)!==issued||description.length<3||description.length>3000||!Number.isFinite(amount)||amount<0||amount>999999999||key.length>100)return proFail("Confira nÃºmero, data, serviÃ§o, valor e chave da nota emitida.");
   path=`${c.organization.id}/notes/${id}.pdf`;record={...record,number,issued_on:issued,service_description:description,amount,verification_key:key,file_path:path,file_name:file.name.slice(0,160)};
  }
  const bucket=c.admin.storage.from("vallex-pro"),upload=await bucket.upload(path,content,{contentType:mime,upsert:false});
  if(upload.error)return proFail("NÃ£o foi possÃ­vel armazenar o arquivo. Confira o bucket privado vallex-pro.",503);
  const saved=await c.admin.from(purpose==="portfolio"?"provider_portfolio":"provider_fiscal_notes").insert(record);
  if(saved.error){await bucket.remove([path]);return proFail("NÃ£o foi possÃ­vel salvar. Confira se esta nota jÃ¡ foi registrada.",409);}
  return NextResponse.json({ok:true,message:purpose==="portfolio"?"Foto adicionada Ã  galeria da Vitrine.":"Nota emitida registrada e anexada. Nenhuma nota foi emitida por este sistema."},{headers:noStore});
 }catch{return proFail("NÃ£o foi possÃ­vel concluir a operaÃ§Ã£o.",500);}
}
export async function DELETE(request:Request){
 try{const c=await providerContext(request);if("error" in c)return c.error;if(c.role!=="owner")return proFail("AÃ§Ã£o exclusiva do proprietÃ¡rio.",403);
  const body=await request.json();if(!uuid(body.id))return proFail("Foto invÃ¡lida.");
  const row=await c.admin.from("provider_portfolio").select("id,file_path").eq("id",body.id).eq("organization_id",c.organization.id).maybeSingle();
  if(row.error||!row.data)return proFail("Foto nÃ£o encontrada.",404);
  const removed=await c.admin.from("provider_portfolio").delete().eq("id",row.data.id).eq("organization_id",c.organization.id);if(removed.error)return proFail("NÃ£o foi possÃ­vel remover a foto.",503);
  await c.admin.storage.from("vallex-pro").remove([row.data.file_path]);return NextResponse.json({ok:true,message:"Foto removida da galeria."},{headers:noStore});
 }catch{return proFail("NÃ£o foi possÃ­vel remover a foto.",500);}
}
