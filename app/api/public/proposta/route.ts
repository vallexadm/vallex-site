import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {providerAdmin} from "@/lib/server/provider-context";
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
export async function POST(request:Request){try{const raw=await request.text();if(raw.length>400)throw Error();const b=JSON.parse(raw);if(!/^[a-f0-9]{64}$/.test(b.token)||!["consultar","aprovado","recusado"].includes(b.action))throw Error();
 const r=await providerAdmin().rpc("respond_quote_link",{p_hash:createHash("sha256").update(b.token).digest("hex"),p_decision:b.action==="consultar"?null:b.action});
 if(r.error)throw Error();return NextResponse.json({ok:true,proposal:r.data},{headers});
 }catch{return NextResponse.json({ok:false,message:"Link indisponível, proposta alterada, vencida ou já respondida. Peça um novo envio ao prestador."},{status:409,headers});}}
