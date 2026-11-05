import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {providerAdmin,proFail} from "@/lib/server/provider-context";
import {getPlanEntitlements} from "@/lib/server/plan-entitlements";
export const runtime="nodejs";
export async function POST(request:Request){
 try{const text=await request.text();if(text.length>12000)return proFail("Solicitação inválida.");const body=JSON.parse(text);
 if(typeof body.token!=="string"||!/^[a-f0-9]{64}$/.test(body.token))return proFail("Link inválido ou expirado.",404);
 const admin=providerAdmin(),hash=createHash("sha256").update(body.token).digest("hex");
 const r=await admin.from("provider_review_invites").select("id,organization_id,appointment_id,expires_at,used_at").eq("token_hash",hash).maybeSingle();
 if(r.error||!r.data||r.data.used_at||Date.parse(r.data.expires_at)<=Date.now())return proFail("Link inválido, já utilizado ou expirado.",404);
 const i=r.data,[plan,a,org]=await Promise.all([getPlanEntitlements(admin,i.organization_id),admin.from("organization_appointments").select("id,status").eq("id",i.appointment_id).eq("organization_id",i.organization_id).maybeSingle(),admin.from("organizations").select("name").eq("id",i.organization_id).maybeSingle()]);
 if(!plan.entitlements?.canCollectReviews||a.error||a.data?.status!=="completed"||org.error||!org.data)return proFail("Este convite não está disponível.",404);
 if(body.action==="inspect")return NextResponse.json({ok:true,provider:org.data.name},{headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 if(body.action!=="submit"||body.consent!==true)return proFail("Confirme a publicação da sua avaliação.");
 const name=String(body.name||"").trim(),comment=String(body.comment||"").trim();
 if(name.length<2||name.length>80||comment.length<10||comment.length>1500||!Number.isInteger(body.rating)||body.rating<1||body.rating>5)return proFail("Confira nome, nota de 1 a 5 e comentário de 10 a 1.500 caracteres.");
 const saved=await admin.rpc("submit_provider_review",{p_hash:hash,p_name:name,p_rating:body.rating,p_comment:comment});
 if(saved.error)return proFail("O link já foi usado, expirou ou deixou de estar disponível.",409);
 return NextResponse.json({ok:true,message:"Avaliação publicada. Obrigado por compartilhar sua experiência!"},{headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 }catch{return proFail("Não foi possível enviar sua avaliação.",400);}
}
