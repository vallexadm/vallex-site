import {NextResponse} from "next/server";
import {professionalShowcase} from "@/lib/server/professional-showcase";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
 try{const {slug}=await params,c=await professionalShowcase(slug);if(!c)return NextResponse.json({ok:true,photos:[],reviews:[]},{headers:{"Cache-Control":"no-store"}});
 const [photos,reviews]=await Promise.all([
  c.admin.from("provider_portfolio").select("id,caption").eq("organization_id",c.profile.organization_id).order("created_at",{ascending:false}).limit(20),
  c.admin.from("provider_reviews").select("author_name,rating,comment,created_at").eq("organization_id",c.profile.organization_id).order("created_at",{ascending:false}).limit(50)
 ]);
 if(photos.error||reviews.error)return NextResponse.json({ok:false,message:"Não foi possível carregar fotos e avaliações."},{status:503});
 return NextResponse.json({ok:true,photos:(photos.data||[]).map(p=>({...p,url:`/api/public/prestador/${encodeURIComponent(slug)}/fotos/${p.id}`})),reviews:reviews.data||[]},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({ok:false,message:"Não foi possível carregar fotos e avaliações."},{status:503});}
}
