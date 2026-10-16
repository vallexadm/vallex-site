"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import SolicitacaoForm from "@/app/prestador/[slug]/SolicitacaoForm";
import type { PublicProvider } from "@/lib/public-providers";

type DirectoryResponse = {
  ok: boolean;
  message?: string;
  prestadores?: PublicProvider[];
};

const serviceModeLabels: Record<string, string> = {
  presencial: "Presencial",
  domicilio: "Em domicílio",
  online: "Online",
};

export type DirectoryFilters = {
  search: string;
  service: string;
  mode: string;
  location: string;
  allLocations: boolean;
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

export default function Services({
  initialProviders = [],
  isHome = false,
  initialFilters,
}: {
  initialProviders?: PublicProvider[];
  isHome?: boolean;
  initialFilters?: DirectoryFilters;
}) {
  const [providers, setProviders] = useState<PublicProvider[]>(initialProviders);
  const [selectedService, setSelectedService] = useState(initialFilters?.service ?? "");
  const [selectedMode, setSelectedMode] = useState(initialFilters?.mode ?? "");
  const [allLocations, setAllLocations] = useState(initialFilters?.allLocations ?? false);
  const [selectedLocation, setSelectedLocation] = useState(() => {
    if (initialFilters?.allLocations) return "";
    if (initialFilters?.location) return initialFilters.location;
    const goiania = initialProviders.find((provider) =>
      normalizeSearch(provider.service_area || provider.address || "").includes("goiania")
    );
    return goiania ? normalizeSearch(goiania.service_area || goiania.address || "") : "";
  });
  const [search, setSearch] = useState(initialFilters?.search ?? "");
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
          window.location.replace("/sistema/login?next=/catalogo%3Fprevisualizar%3D1");
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

  const serviceOptions = useMemo(() => {
    const services = new Map<string, string>();
    providers.forEach((provider) => {
      (provider.services ?? []).forEach((service) => {
        const key = normalizeSearch(service.name.trim());
        if (key && !services.has(key)) services.set(key, service.name.trim());
      });
    });
    return [...services.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [providers]);

  const locationOptions = useMemo(() => {
    const locations = new Map<string, string>();
    providers.forEach((provider) => {
      const location = (provider.service_area || provider.address)?.trim();
      const key = location ? normalizeSearch(location) : "";
      if (key && location && !locations.has(key)) locations.set(key, location);
    });
    return [...locations.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [providers]);

  const modeOptions = useMemo(() => {
    const modes = new Set(providers.flatMap((provider) => provider.service_modes ?? []));
    return [...modes]
      .filter((mode) => serviceModeLabels[mode])
      .sort((a, b) => serviceModeLabels[a].localeCompare(serviceModeLabels[b], "pt-BR"));
  }, [providers]);

  const goianiaLocationKey = locationOptions.find(({ label }) =>
    normalizeSearch(label).includes("goiania")
  )?.key;

  const filteredProviders = useMemo(() => {
    const term = normalizeSearch(search.trim());
    return providers.filter((provider) => {
      const servesOnline = (provider.service_modes ?? []).includes("online");
      const providerLocation = normalizeSearch(provider.service_area || provider.address || "");
      const matchesLocation =
        !selectedLocation ||
        (Boolean(providerLocation) &&
          (providerLocation.includes(selectedLocation) ||
            selectedLocation.includes(providerLocation)));
      if (selectedLocation && !matchesLocation && !servesOnline) {
        return false;
      }

      if (
        selectedService &&
        !(provider.services ?? []).some(
          (service) => normalizeSearch(service.name.trim()) === selectedService
        )
      ) {
        return false;
      }

      if (selectedMode && !(provider.service_modes ?? []).includes(selectedMode)) {
        return false;
      }

      if (!term) return true;
      const searchable = [
        provider.display_name,
        provider.description,
        provider.address,
        provider.service_area,
        ...(provider.service_modes ?? []).map((mode) => serviceModeLabels[mode] ?? mode),
        ...(provider.services ?? []).flatMap((service) => [service.name, service.description]),
      ]
        .filter(Boolean)
        .join(" ");

      return normalizeSearch(searchable).includes(term);
    });
  }, [providers, search, selectedService, selectedMode, selectedLocation]);

  const hasActiveFilters = Boolean(search || selectedService || selectedMode || selectedLocation);

  function syncFilters(next: Partial<DirectoryFilters>) {
    const url = new URL(window.location.href);
    const current: DirectoryFilters = {
      search,
      service: selectedService,
      mode: selectedMode,
      location: selectedLocation,
      allLocations,
      ...next,
    };
    const params: [string, string][] = [
      ["buscar", current.search],
      ["servico", current.service],
      ["atendimento", current.mode],
    ];
    params.forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    });
    if (current.allLocations) url.searchParams.set("localidade", "todas");
    else if (current.location) url.searchParams.set("localidade", current.location);
    else url.searchParams.delete("localidade");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function clearFilters() {
    setSearch("");
    setSelectedService("");
    setSelectedMode("");
    setSelectedLocation("");
    setAllLocations(true);
    syncFilters({ search: "", service: "", mode: "", location: "", allLocations: true });
  }

  return (
    <>
      <section id="prestadores" className={`provider-directory section${isHome ? " provider-directory-home" : ""}`} aria-labelledby="providers-heading">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Prestadores | ServiçoFácil</span>
            {isHome ? (
              <h2 id="providers-heading">Prestadores perto de você</h2>
            ) : (
              <h1 id="providers-heading">Encontre o serviço ideal</h1>
            )}
            <p>
              Pesquise por nome ou serviço e refine por especialidade e
              localidade. Começamos por Goiânia e ampliamos a busca conforme
              novos prestadores chegam à plataforma.
            </p>
          </div>

          {previewMode && (
            <div className="directory-preview-notice">
              Configure sua Vitrine e confira como ela ficará antes de publicar.
              Esta prévia é particular; os clientes só poderão acessá-la depois da publicação.
            </div>
          )}

          <div className="directory-filters" role="search" aria-label="Buscar prestadores">
            <div className="directory-filter directory-filter-search">
              <label className="directory-search-label" htmlFor="provider-search">
                Buscar prestador ou serviço
              </label>
              <input
                id="provider-search"
                className="directory-search"
                type="search"
                value={search}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearch(value);
                  syncFilters({ search: value });
                }}
                placeholder="Ex.: advogada, barbearia, geladeira"
              />
            </div>

            <div className="directory-filter">
              <label className="directory-search-label" htmlFor="provider-service">
                Tipo de serviço
              </label>
              <select
                id="provider-service"
                className="directory-select"
                value={selectedService}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedService(value);
                  syncFilters({ service: value });
                }}
              >
                <option value="">Todos os serviços</option>
                {serviceOptions.map((option) => (
                  <option value={option.key} key={option.key}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="directory-filter">
              <label className="directory-search-label" htmlFor="provider-location">
                Cidade ou região
              </label>
              <select
                id="provider-location"
                className="directory-select"
                value={selectedLocation}
                onChange={(event) => {
                  const value = event.target.value;
                  const nextAllLocations = !value;
                  setSelectedLocation(value);
                  setAllLocations(nextAllLocations);
                  syncFilters({ location: value, allLocations: nextAllLocations });
                }}
              >
                <option value="">Todas as localidades</option>
                {locationOptions.map((option) => (
                  <option value={option.key} key={option.key}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="directory-filter">
              <label className="directory-search-label" htmlFor="provider-mode">
                Forma de atendimento
              </label>
              <select
                id="provider-mode"
                className="directory-select"
                value={selectedMode}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedMode(value);
                  syncFilters({ mode: value });
                }}
              >
                <option value="">Todas as formas</option>
                {modeOptions.map((mode) => (
                  <option value={mode} key={mode}>{serviceModeLabels[mode]}</option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button type="button" className="directory-clear" onClick={clearFilters}>
                Limpar filtros
              </button>
            )}
          </div>

          <p className="directory-filter-note">
            Os prestadores informam as regiões e formas de atendimento.
            {goianiaLocationKey ? " A busca começa por Goiânia; prestadores online também podem aparecer. Selecione outra localidade ou limpe os filtros para ver todos." : " Goiânia é o ponto de partida; novas cidades poderão ser incluídas pelos prestadores."}
          </p>

          {!loading && !error && (
            <p className="directory-result-count" aria-live="polite">
              {filteredProviders.length} {filteredProviders.length === 1 ? "prestador encontrado" : "prestadores encontrados"}
            </p>
          )}

          {loading ? (
            <p className="directory-feedback">Carregando prestadores...</p>
          ) : error ? (
            <p className="directory-feedback directory-error" role="alert">
              {error}
            </p>
          ) : filteredProviders.length === 0 ? (
            <div className="directory-empty">
              <h3>
                {hasActiveFilters
                  ? "Nenhum prestador encontrado"
                  : "Ainda não há prestadores publicados"}
              </h3>
              <p>
                {hasActiveFilters
                  ? "Tente mudar a busca ou os filtros para encontrar outros prestadores."
                  : "Quando os prestadores publicarem suas Vitrines, eles aparecerão aqui."}
              </p>
              {hasActiveFilters && (
                <button type="button" className="button button-outline directory-empty-button" onClick={clearFilters}>
                  Ver todos os prestadores
                </button>
              )}
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
                      {(provider.service_area || provider.address) && <p className="provider-location">{provider.service_area || provider.address}</p>}
                    </div>
                    {provider.is_preview && <span className="provider-preview-badge">Prévia privada</span>}
                  </div>

                  {provider.description && (
                    <p className="provider-description">{provider.description}</p>
                  )}

                  {(provider.service_modes ?? []).length > 0 && (
                    <ul className="provider-mode-list" aria-label="Formas de atendimento">
                      {(provider.service_modes ?? []).map((mode) => (
                        <li key={mode}>{serviceModeLabels[mode] ?? mode}</li>
                      ))}
                    </ul>
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

      {isHome && (
        <section className="provider-join-section" aria-labelledby="provider-join-heading">
          <div className="container">
            <div className="provider-join-heading">
              <span className="eyebrow">Cresça com a VALLEX</span>
              <h2 id="provider-join-heading">Escolha como podemos ajudar seu negócio</h2>
              <p>Você pode divulgar seus serviços, atrair clientes com tráfego pago ou enviar uma proposta para uma necessidade específica.</p>
            </div>
            <div className="provider-service-options">
              <article className="provider-service-option">
                <span className="provider-service-option-label">ServiçoFácil</span>
                <h3>Cadastre-se na VALLEX</h3>
                <p>Tenha ferramentas para divulgar seu trabalho, receber pedidos de orçamento e organizar clientes, atendimentos e finanças.</p>
                <Link href="/sistema/login?cadastro=1" className="button button-primary">
                  Criar minha conta
                </Link>
              </article>
              <article className="provider-service-option">
                <span className="provider-service-option-label">Tráfego pago</span>
                <h3>Conquiste mais visibilidade</h3>
                <p>Conheça nossas soluções de campanhas para alcançar novos clientes e divulgar seu negócio.</p>
                <Link href="/trafego-pago" className="button button-primary">
                  Conhecer tráfego pago
                </Link>
              </article>
              <article className="provider-service-option">
                <span className="provider-service-option-label">Solução personalizada</span>
                <h3>Envie sua proposta</h3>
                <p>Tem outra necessidade? Conte para nós o que você precisa e envie sua proposta pelo formulário.</p>
                <Link href="/contato#formulario-orcamento" className="button button-primary">
                  Enviar minha proposta
                </Link>
              </article>
            </div>
          </div>
        </section>
      )}

    </>
  );
}
