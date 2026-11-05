import {NextResponse} from "next/server";
import {professionalShowcase} from "@/lib/server/professional-showcase";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{slug:string;id:string}>}){
 try{const {slug,id}=await params,c=await professionalShowcase(slug);if(!c)return new Response(null,{status:404});
 const row=await c.admin.from("provider_portfolio").select("file_path").eq("id",id).eq("organization_id",c.profile.organization_id).maybeSingle();
 if(row.error||!row.data)return new Response(null,{status:404});
 const link=await c.admin.storage.from("vallex-pro").createSignedUrl(row.data.file_path,60);if(link.error||!link.data?.signedUrl)return new Response(null,{status:404});
 return NextResponse.redirect(link.data.signedUrl,{status:302,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 }catch{return new Response(null,{status:503});}
}
