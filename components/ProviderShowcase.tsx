"use client";

import { useEffect, useState } from "react";

type Review = { author_name: string; rating: number; comment: string; created_at: string; serviceId: string | null };
type Showcase = { photos: { id: string; caption: string; url: string }[]; reviews: Review[] };

export default function ProviderShowcase({ slug, services }: { slug: string; services: { id: string; name: string }[] }) {
  const [data, setData] = useState<Showcase | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/public/prestador/${encodeURIComponent(slug)}/destaques`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error();
        setData(result);
      })
      .catch(() => { if (!controller.signal.aborted) setError("Fotos e avaliações indisponíveis no momento."); });
    return () => controller.abort();
  }, [slug]);

  if (error) return <p className="mx-auto max-w-5xl px-6 py-3 text-sm text-slate-500">{error}</p>;
  if (!data || (!data.photos.length && !data.reviews.length)) return null;

  const general = data.reviews.filter(review => !services.some(service => service.id === review.serviceId));
  const groups = [
    ...services.map(service => ({ id: service.id, title: service.name, reviews: data.reviews.filter(review => review.serviceId === service.id) })),
    { id: "general", title: "Avaliações gerais", reviews: general },
  ].filter(group => group.reviews.length);

  return <section className="mx-auto max-w-5xl space-y-8 px-6 py-8">
    {data.photos.length > 0 && <div>
      <h2 className="mb-4 text-2xl font-bold">Fotos dos serviços</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {data.photos.map(photo => <figure className="overflow-hidden rounded-xl border bg-white" key={photo.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={photo.caption} loading="lazy" className="h-44 w-full object-cover" />
          <figcaption className="p-3 text-sm text-slate-700">{photo.caption}</figcaption>
        </figure>)}
      </div>
    </div>}
    {groups.length > 0 && <div className="space-y-6">
      <h2 className="text-2xl font-bold">Avaliações de clientes</h2>
      {groups.map(group => <section key={group.id}>
        <h3 className="text-lg font-semibold">{group.title}</h3>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          {group.reviews.length} {group.reviews.length === 1 ? "avaliação recente" : "avaliações recentes"} · média {(group.reviews.reduce((sum, review) => sum + review.rating, 0) / group.reviews.length).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} de 5
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {group.reviews.map((review, index) => <article key={index} className="rounded-xl border bg-white p-5">
            <p className="font-semibold">{review.author_name}</p>
            <p className="my-2 text-amber-700" aria-label={`${review.rating} de 5 estrelas`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{review.comment}</p>
            <p className="mt-3 text-xs text-slate-500">{new Date(review.created_at).toLocaleDateString("pt-BR")}</p>
          </article>)}
        </div>
      </section>)}
    </div>}
  </section>;
}
