"use client";
import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
export default function ActionNotice({message,error=false,inline=false,onClose}:{message:string;error?:boolean;inline?:boolean;onClose:()=>void}){
 const [target,setTarget]=useState<HTMLElement|null>(null);
 useEffect(()=>{if(inline||!message)return;let host=document.getElementById("vallex-notifications");if(!host){host=document.createElement("div");host.id="vallex-notifications";host.setAttribute("aria-label","Notificações do sistema");Object.assign(host.style,{position:"fixed",bottom:"max(1rem, env(safe-area-inset-bottom))",right:"1rem",width:"min(32rem, calc(100vw - 2rem))",maxHeight:"65dvh",overflowY:"auto",display:"flex",flexDirection:"column",gap:"0.75rem",zIndex:"10010",pointerEvents:"none"});document.body.appendChild(host);}const timer=window.setTimeout(()=>setTarget(host),0);return()=>window.clearTimeout(timer);},[inline,message]);
 if(!message)return null;
 const notice=<div role={error?"alert":"status"} aria-live={error?"assertive":"polite"} aria-atomic="true" className={`${inline?"mt-4":""} pointer-events-auto flex w-full items-start gap-3 overflow-auto rounded-xl border p-4 shadow-lg ${error?"border-red-200 bg-red-50 text-red-800":"border-green-200 bg-green-50 text-green-800"}`}><p className="min-w-0 flex-1 break-words text-sm font-semibold">{message}</p><button type="button" onClick={onClose} aria-label="Fechar mensagem" className="shrink-0 rounded border border-current px-3 py-2 text-sm">Fechar</button></div>;
 return inline?notice:target?createPortal(notice,target):null;
}
