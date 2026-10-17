import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { getPlanEntitlements } from "@/lib/server/plan-entitlements";
import { absoluteSiteUrl, isLegalServicesProfile } from "@/lib/seo";
import SolicitacaoForm from "./SolicitacaoForm";

type PublicProfile = {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  service_area: string | null;
  service_modes: string[];
  logo_url: string | null;
  is_published: boolean;
};

type PublicService = {
  id: string;
  name: string;
  description: string | null;
  price: number | string | null;
  display_order: number;
  is_published: boolean;
};

type PublicVitrine = {
  profile: PublicProfile;
  services: PublicService[];
};

const serviceModeLabels: Record<string, string> = {
  presencial: "Presencial",
  domicilio: "Em domicílio",
  online: "Online",
};

const carregarVitrine = cache(async function carregarVitrine(
  slug: string
): Promise<PublicVitrine> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error("Configuração do servidor indisponível para carregar a Vitrine.");
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const normalizedSlug = slug.trim().toLowerCase();

  const { data: profile, error: profileError } = await admin
    .from("organization_public_profiles")
    .select(
      "id,slug,display_name,description,phone,whatsapp,email,address,service_area,service_modes,logo_url,is_published,organization_id"
    )
    .eq("slug", normalizedSlug)
    .eq("is_published", true)
    .maybeSingle();

  if (profileError) {
    console.error("Erro ao carregar a Vitrine:", profileError);
    throw new Error("Não foi possível carregar a Vitrine.");
  }

  if (!profile) notFound();

  const { data: services, error: servicesError } = await admin
    .from("vitrine_services")
    .select("id,name,description,price,display_order,is_published")
    .eq("organization_id", profile.organization_id)
    .eq("is_published", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (servicesError) {
    console.error("Erro ao carregar serviços da Vitrine:", servicesError);
    throw new Error("Não foi possível carregar os serviços da Vitrine.");
  }

  const planResult = await getPlanEntitlements(admin, profile.organization_id);
  if (!planResult.entitlements) throw new Error(planResult.error);
  const visibleServices = planResult.entitlements.maxServices === null
    ? services ?? []
    : (services ?? []).slice(0, planResult.entitlements.maxServices);

  return {
    profile,
    services: visibleServices,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { profile, services } = await carregarVitrine(slug);
  const focus = services
    .slice(0, 2)
    .map((service) => service.name.trim())
    .filter(Boolean)
    .join(" e ") || "Serviços";
  const serviceArea = profile.service_area?.trim();
  const title = serviceArea
    ? `${focus} em ${serviceArea} | ${profile.display_name} | VALLEX`
    : `${focus} | ${profile.display_name} | VALLEX ServiçoFácil`;
  const descriptionParts = [
    profile.description?.trim(),
    serviceArea ? `Atendimento em ${serviceArea}.` : undefined,
    services
      .slice(0, 2)
      .map((service) => service.description?.trim())
      .filter(Boolean)
      .join(" "),
  ].filter(Boolean);
  const description = (
    descriptionParts.join(" ") ||
    `${profile.display_name}: conheça os serviços, formas de atendimento e contato pela Vitrine Pública do ServiçoFácil da VALLEX.`
  ).slice(0, 160);
  const canonical = `/prestador/${encodeURIComponent(profile.slug)}`;
  const isLegalProfile = isLegalServicesProfile({
    display_name: profile.display_name,
    description: profile.description,
    services,
  });

  return {
    title,
    description,
    alternates: { canonical },
    robots: isLegalProfile ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      url: absoluteSiteUrl(canonical),
      title,
      description,
      siteName: "VALLEX ServiçoFácil",
    },
  };
}

function formatarPreco(
  price: number | string | null
) {
  if (price === null || price === undefined) {
    return "Preço sob consulta";
  }

  const valor =
    typeof price === "number"
      ? price
      : Number(String(price).replace(",", "."));

  if (!Number.isFinite(valor)) {
    return "Preço sob consulta";
  }

  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default async function PrestadorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { profile, services } =
    await carregarVitrine(slug);
  const whatsappNumber = (profile.whatsapp ?? "").replace(/\D/g, "");
  const whatsappNumberWithCountryCode =
    whatsappNumber.startsWith("55") || whatsappNumber.length > 11
      ? whatsappNumber
      : `55${whatsappNumber}`;
  const whatsappMessage = encodeURIComponent(
    `Olá! Encontrei seu perfil no site da VALLEX - ServiçoFácil.
Gostaria de saber mais sobre seus valores e condições de atendimento local, podemos conversar por aqui?`
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            {profile.logo_url ? (
              <img
                src={profile.logo_url}
                alt={`Logo de ${profile.display_name}`}
                className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 object-contain sm:h-14 sm:w-14"
              />
            ): 
            
            (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-700 text-lg font-bold text-white">
                {profile.display_name
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                ServiçoFácil
              </p>

              <h1 className="text-lg font-bold">
                {profile.display_name}
              </h1>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Link
              href="/#providers-heading"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:text-sm"
            >
              ← Voltar aos prestadores
            </Link>
            <span className="hidden rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 sm:inline-flex">
              Prestador verificado
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-purple-700">
              Atendimento e serviços
            </p>

            <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              {profile.display_name}
            </h2>

            {profile.description && (
              <p className="mt-5 whitespace-pre-line text-lg leading-8 text-slate-600">
                {profile.description}
              </p>
            )}
          </div>

          <div className="mt-8 grid gap-4 border-t border-slate-200 pt-8 sm:grid-cols-2">
            {profile.phone && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Telefone
                </p>

                <p className="mt-1 text-sm text-slate-700">
                  {profile.phone}
                </p>
              </div>
            )}

            {profile.whatsapp && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  WhatsApp
                </p>

                <p className="mt-1 text-sm text-slate-700">
                  {profile.whatsapp}
                </p>
              </div>
            )}

            {profile.email && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  E-mail
                </p>

                <p className="mt-1 break-all text-sm text-slate-700">
                  {profile.email}
                </p>
              </div>
            )}

            {profile.address && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Localização
                </p>

                <p className="mt-1 text-sm text-slate-700">
                  {profile.address}
                </p>
              </div>
            )}

            {profile.service_area && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Região atendida
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {profile.service_area}
                </p>
              </div>
            )}

            {(profile.service_modes ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Modalidades
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(profile.service_modes ?? []).map((mode) => (
                    <span key={mode} className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                      {serviceModeLabels[mode] ?? mode}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-200 pt-8">
            {profile.whatsapp && (
              <a
                href={`https://wa.me/${whatsappNumberWithCountryCode}?text=${whatsappMessage}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Falar pelo WhatsApp
              </a>
            )}

            {profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Enviar e-mail
              </a>
            )}

            <Link
              href="#servicos"
              className="rounded-lg bg-purple-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-800"
            >
              Ver serviços
            </Link>
          </div>
        </div>

        <section
          id="servicos"
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <div>
            <p className="text-sm font-semibold text-purple-700">
              Serviços
            </p>

            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              Serviços disponíveis
            </h3>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Confira os serviços publicados por este prestador.
            </p>
          </div>

          {services.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <h4 className="text-lg font-semibold text-slate-900">
                Nenhum serviço publicado no momento
              </h4>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                Este prestador ainda não possui serviços
                disponíveis publicamente.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {services.map((service) => (
                <article
                  key={service.id}
                  className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-purple-500 hover:shadow-md focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100"
                >
                  <div className="flex-1">
                    <h4 className="text-xl font-semibold text-slate-900">
                      {service.name}
                    </h4>

                    {service.description && (
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                        {service.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <p className="text-lg font-bold text-purple-700">
                      {formatarPreco(service.price)}
                    </p>
                  </div>
                  <SolicitacaoForm
                    slug={profile.slug}
                    serviceId={service.id}
                    serviceName={service.name}
                  />
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-6 text-center">
          <p className="text-xs text-slate-500">
            Esta página é disponibilizada pelo ServiçoFácil,
            plataforma da VALLEX.
          </p>
        </div>
      </footer>
    </main>
  );
}
