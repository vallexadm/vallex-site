"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import SolicitacaoForm from "@/app/prestador/[slug]/SolicitacaoForm";
import type { PublicProvider } from "@/lib/public-providers";

const specialties = [
  {
    title: "Informática",
    description: "Suporte e manutenção para residências, empresas e comércios.",
    icon: "01",
  },
  {
    title: "Elétrica",
    description: "Instalações e reparos em diferentes ambientes.",
    icon: "02",
  },
  {
    title: "Redes e conectividade",
    description: "Wi-Fi e conectividade para casa, empresa ou comércio.",
    icon: "03",
  },
  {
    title: "Soluções digitais",
    description: "Sites e aplicações para profissionais e negócios.",
    icon: "04",
  },
];

type DirectoryResponse = {
  ok: boolean;
  message?: string;
  prestadores?: PublicProvider[];
};

function formatPrice(price: number | string | null) {
  if (price === null || price === undefined || price === "") {
    return "Preço sob consulta";
  }

  const value = typeof price === "number" ? price : Number(String(price).replace(",", "."));

  return Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "Preço sob consulta";
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export default function Services({ initialProviders = [] }: { initialProviders?: PublicProvider[] }) {
  const [providers, setProviders] = useState<PublicProvider[]>(initialProviders);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDirectory() {
      const isPreview =
        new URLSearchParams(window.location.search).get("previsualizar") === "1";
      setPreviewMode(isPreview);
      if (!isPreview) return;
      setLoading(true);

      try {
        const headers: Record<string, string> = {};

        if (isPreview) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;

          if (!token) {
          window.location.replace("/sistema/login?next=/servicos%3Fprevisualizar%3D1");
            return;
          }

          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(
          `/api/public/prestadores${isPreview ? "?previsualizar=1" : ""}`,
          { headers, cache: "no-store" }
        );
        const result: DirectoryResponse = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.message || "Não foi possível carregar os prestadores.");
        }

        if (active) setProviders(result.prestadores ?? []);
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar os prestadores."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDirectory();
    return () => {
      active = false;
    };
  }, []);

  const filteredProviders = useMemo(() => {
    const term = normalizeSearch(search.trim());
    if (!term) return providers;

    return providers.filter((provider) => {
      const searchable = [
        provider.display_name,
        provider.description,
        provider.address,
        ...(provider.services ?? []).flatMap((service) => [service.name, service.description]),
      ]
        .filter(Boolean)
        .join(" ");

      return normalizeSearch(searchable).includes(term);
    });
  }, [providers, search]);

  return (
    <>
      <section className="provider-directory section" aria-labelledby="providers-heading">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Serviços VALLEX | ServiçoFácil</span>
            <h1 id="providers-heading">Encontre o serviço ideal</h1>
            <p>
              Soluções para residências, empresas e comércios. Pesquise os
              serviços disponíveis e solicite um orçamento pela Vitrine do
              prestador.
            </p>
          </div>

          {previewMode && (
            <div className="directory-preview-notice">
              Prévia de desenvolvimento: sua Vitrine não publicada aparece
              somente para você. Clientes não conseguem acessá-la por esta prévia.
            </div>
          )}

          <label className="directory-search-label" htmlFor="provider-search">
            Buscar por serviço, prestador ou localização
          </label>
          <input
            id="provider-search"
            className="directory-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ex.: manutenção de computadores"
          />

          {loading ? (
            <p className="directory-feedback">Carregando prestadores...</p>
          ) : error ? (
            <p className="directory-feedback directory-error" role="alert">
              {error}
            </p>
          ) : filteredProviders.length === 0 ? (
            <div className="directory-empty">
              <h3>
                {search
                  ? "Nenhum prestador encontrado"
                  : "Ainda não há prestadores publicados"}
              </h3>
              <p>
                {search
                  ? "Tente buscar por outro serviço ou nome."
                  : "Quando os prestadores publicarem suas Vitrines, eles aparecerão aqui."}
              </p>
            </div>
          ) : (
            <div className="provider-grid">
              {filteredProviders.map((provider) => (
                <article className="provider-card" key={provider.id}>
                  <div className="provider-card-heading">
                    {provider.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={provider.logo_url} alt="" className="provider-logo" />
                    ) : (
                      <span className="provider-logo provider-logo-fallback" aria-hidden="true">
                        {provider.display_name.charAt(0).toLocaleUpperCase("pt-BR")}
                      </span>
                    )}
                    <div>
                      <h3>{provider.display_name}</h3>
                      {provider.address && <p className="provider-location">{provider.address}</p>}
                    </div>
                    {provider.is_preview && <span className="provider-preview-badge">Prévia privada</span>}
                  </div>

                  {provider.description && (
                    <p className="provider-description">{provider.description}</p>
                  )}

                  <div className="provider-services">
                    <h4>Serviços</h4>
                    {(provider.services ?? []).length === 0 ? (
                      <p className="provider-no-services">Nenhum serviço disponível.</p>
                    ) : (
                      <ul>
                        {(provider.services ?? []).map((service) => (
                          <li key={service.id}>
                            <span>
                              <strong>{service.name}</strong>
                              {service.description && <small>{service.description}</small>}
                              {provider.is_preview && !service.is_published && (
                                <small className="provider-unpublished-label">Ainda não publicado</small>
                              )}
                            </span>
                            <span className="provider-price">{formatPrice(service.price)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {provider.is_published ? (
                    <Link className="button button-primary provider-open-button" href={`/prestador/${encodeURIComponent(provider.slug)}`}>
                      Ver Vitrine e solicitar orçamento
                    </Link>
                  ) : (
                    <>
                      <p className="provider-private-hint">
                        Esta Vitrine é privada. O formulário abaixo permite
                        testar uma solicitação local sem publicá-la.
                      </p>
                      <div className="provider-preview-forms">
                        {(provider.services ?? []).map((service) => (
                          <SolicitacaoForm
                            key={service.id}
                            slug={provider.slug}
                            serviceId={service.id}
                            serviceName={service.name}
                            previewOnlyLocal
                          />
                        ))}
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="services section specialty-section">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Áreas de atendimento</span>
            <h2>Serviços para diferentes necessidades</h2>
            <p>
              Conheça algumas das áreas atendidas pelos prestadores da
              plataforma.
            </p>
          </div>

          <div className="service-grid">
            {specialties.map((specialty) => (
              <article className="service-card" key={specialty.icon}>
                <span className="service-number">{specialty.icon}</span>
                <h3>{specialty.title}</h3>
                <p>{specialty.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
