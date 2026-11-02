import {NextResponse} from "next/server";
import {providerContext,proFail} from "@/lib/server/provider-context";
export async function POST(request:Request){try{const c=await providerContext(request);if("error" in c)return c.error;
if(c.role!=="owner"&&!c.permissions.agenda.updateAssigned&&!c.permissions.agenda.manage&&!c.permissions.quotes.create)return proFail("Sem permissão para calcular deslocamentos.",403);
const raw=await request.text();if(raw.length>2000)return proFail("Endereços muito longos.");const b=JSON.parse(raw);
if(typeof b.origin!=="string"||typeof b.destination!=="string"||[b.origin,b.destination].some(v=>v.trim().length<5||v.length>350)||!["DRIVE","TWO_WHEELER"].includes(b.vehicle))return proFail("Informe origem, destino completos e veículo.");
const departure=b.departure?new Date(b.departure):new Date(Date.now()+30000);if(!Number.isFinite(departure.getTime())||departure.getTime()<Date.now()-60000||departure.getTime()>Date.now()+7*86400000)return proFail("Escolha uma saída entre agora e os próximos 7 dias.");
const key=process.env.GOOGLE_ROUTES_API_KEY;if(!key)return proFail("O cálculo de rota ainda não está habilitado. Você pode informar a distância e a previsão manualmente.",503);
const r=await fetch("https://routes.googleapis.com/directions/v2:computeRoutes",{method:"POST",headers:{"Content-Type":"application/json","X-Goog-Api-Key":key,"X-Goog-FieldMask":"routes.distanceMeters,routes.duration"},body:JSON.stringify({origin:{address:b.origin.trim()},destination:{address:b.destination.trim()},travelMode:b.vehicle,routingPreference:"TRAFFIC_AWARE",departureTime:new Date(Math.max(departure.getTime(),Date.now()+10000)).toISOString(),languageCode:"pt-BR",regionCode:"BR"}),signal:AbortSignal.timeout(12000),cache:"no-store"});
if(!r.ok)return proFail("Não foi possível calcular a rota. Confira os endereços ou informe a previsão manualmente.",503);const data=await r.json(),route=data.routes?.[0],seconds=Number(String(route?.duration||"").replace(/s$/,""));
if(!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(route?.distanceMeters))return proFail("Nenhuma rota encontrada.",404);
return NextResponse.json({ok:true,distanceKm:Math.round(route.distanceMeters/100)/10,durationMinutes:Math.ceil(seconds/60),calculatedAt:new Date().toISOString()},{headers:{"Cache-Control":"private, no-store"}});
}catch{return proFail("Não foi possível calcular o deslocamento. Tente novamente ou informe manualmente.",503);}}
