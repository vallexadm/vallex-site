"use client";
import {useState} from "react";
import {supabase} from "@/lib/supabase/client";
import ActionNotice from "@/components/ActionNotice";
export default function ProQuoteActions({id,phone}:{id:string;phone?:string|null}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[url,setUrl]=useState(""),[notice,setNotice]=useState("");
  async function generate(share=false){
    setBusy(true);setError("");setUrl("");
    try{const {data}=await supabase.auth.getSession();if(!data.session)throw Error("Entre novamente.");
      const r=await fetch(`/api/sistema/orcamentos/${id}/pdf`,{method:share?"POST":"GET",headers:{Authorization:`Bearer ${data.session.access_token}`}});
      if(!r.ok)throw Error((await r.json()).message||"Não foi possível gerar o PDF.");
      if(share){setUrl((await r.json()).url);}else{
        const object=URL.createObjectURL(await r.blob()),a=document.createElement("a");a.href=object;a.download="orcamento.pdf";a.click();setTimeout(()=>URL.revokeObjectURL(object),10000);
      }
    }catch(e){setError(e instanceof Error?e.message:"Falha ao gerar PDF.");}finally{setBusy(false);}
  }
  const digits=(phone||"").replace(/\D/g,""),destination=digits.length===10||digits.length===11?`55${digits}`:digits;
  return <div className="mt-3 space-y-2 text-left"><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={()=>void generate()} className="rounded-lg border border-purple-300 px-3 py-2 text-xs font-semibold text-purple-800">{busy?"Preparando…":"Baixar orçamento PDF · Pro"}</button><button type="button" disabled={busy} onClick={()=>void generate(true)} className="rounded-lg border border-purple-300 px-3 py-2 text-xs font-semibold text-purple-800">Preparar envio do PDF</button></div>
    {notice&&<ActionNotice inline message={notice} onClose={()=>setNotice("")}/>}
    {error&&<ActionNotice inline error message={error} onClose={()=>setError("")}/>}
    {url&&<div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs"><p>PDF pronto. Link válido por 7 dias. Revise antes de enviar.</p><a className="mt-2 block break-all text-purple-800 underline" href={url} target="_blank" rel="noreferrer">Abrir PDF</a><button type="button" onClick={()=>{void navigator.clipboard.writeText(url).then(()=>setNotice("Link copiado."),()=>setError("Não foi possível copiar; use o link acima."));}} className="mt-2 rounded border px-2 py-1">Copiar link</button>{destination&&<a className="mt-2 block font-semibold text-green-900 underline" target="_blank" rel="noreferrer" href={`https://wa.me/${destination}?text=${encodeURIComponent(`Olá! Segue o orçamento em PDF: ${url}`)}`}>Revisar mensagem no WhatsApp</a>}</div>}
  </div>;
}
