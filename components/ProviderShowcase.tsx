"use client";
/* eslint-disable @next/next/no-img-element */
import {useEffect,useState} from "react";
type Showcase={photos:{id:string;caption:string;url:string}[];reviews:{author_name:string;rating:number;comment:string;created_at:string}[]};
export default function ProviderShowcase({slug}:{slug:string}){
 const [data,setData]=useState<Showcase|null>(null),[error,setError]=useState("");
 useEffect(()=>{let active=true;fetch(`/api/public/prestador/${encodeURIComponent(slug)}/destaques`,{cache:"no-store"}).then(async r=>{const b=await r.json();if(!r.ok||!b.ok)throw Error("Fotos e avaliações indisponíveis no momento.");if(active)setData(b);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[slug]);
 if(error)return <p className="mx-auto max-w-5xl px-6 py-3 text-sm text-slate-500">{error}</p>;
 if(!data||(!data.photos.length&&!data.reviews.length))return null;
 return <section className="mx-auto max-w-5xl space-y-8 px-6 py-8">
  {data.photos.length>0&&<div><h2 className="mb-4 text-2xl font-bold">Fotos dos serviços</h2><div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{data.photos.map(p=><figure className="overflow-hidden rounded-xl border bg-white" key={p.id}><img src={p.url} alt={p.caption} loading="lazy" className="h-44 w-full object-cover"/><figcaption className="p-3 text-sm text-slate-700">{p.caption}</figcaption></figure>)}</div></div>}
  {data.reviews.length>0&&<div><h2 className="text-2xl font-bold">Avaliações de clientes</h2><p className="mb-4 mt-2 text-sm text-slate-600">{data.reviews.length} avaliações recentes de atendimentos concluídos · média {(data.reviews.reduce((n,r)=>n+r.rating,0)/data.reviews.length).toFixed(1)} de 5</p><div className="grid gap-4 sm:grid-cols-2">{data.reviews.map((r,index)=><article key={index} className="rounded-xl border bg-white p-5"><p className="font-semibold">{r.author_name}</p><p className="my-2 text-amber-700" aria-label={`${r.rating} de 5 estrelas`}>{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</p><p className="whitespace-pre-wrap break-words text-sm text-slate-700">{r.comment}</p><p className="mt-3 text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString("pt-BR")}</p></article>)}</div></div>}
 </section>;
}
