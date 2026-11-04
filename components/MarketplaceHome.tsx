"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PublicProvider } from "@/lib/public-providers";
import { filterMarketplace, marketplaceCategories, marketplaceFiltersFromParams, type MarketplaceFilters } from "@/lib/marketplace";
import Icon from "./MarketplaceIcon";
import styles from "./Marketplace.module.css";

const modes: Record<string,string> = { domicilio: "Em domicílio", presencial: "No local", online: "Online" };

export default function MarketplaceHome({ providers, initialFilters, compact = false }: { providers: PublicProvider[]; initialFilters: MarketplaceFilters; compact?: boolean }) {
  const [filters,setFilters] = useState(initialFilters);
  useEffect(() => { const sync = () => setFilters(marketplaceFiltersFromParams(new URLSearchParams(window.location.search))); window.addEventListener("popstate",sync); return () => window.removeEventListener("popstate",sync); },[]);
  function update(next: Partial<MarketplaceFilters>) {
    const value = { ...filters,...next }; setFilters(value);
    const url = new URL(window.location.href);
    for (const [key,entry] of [["buscar",value.search],["localidade",value.location],["categoria",value.category === "all" ? "" : value.category],["atendimento",value.mode],["ordem",value.sort === "az" ? "" : value.sort]]) {
      if (entry) url.searchParams.set(key,entry); else url.searchParams.delete(key);
    }
    window.history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);
  }
  const results = useMemo(() => filterMarketplace(providers,filters),[providers,filters]);
  const active = Boolean(filters.search || filters.location || filters.mode || filters.category !== "all");
  return <main className={styles.home}>
    <nav className={styles.categories} aria-label="Categorias de prestadores">{marketplaceCategories.map(category => <button type="button" key={category.id} aria-pressed={filters.category === category.id} className={filters.category === category.id ? styles.selectedCategory : undefined} onClick={() => update({category:category.id})}><Icon name={category.icon} /><span>{category.label}</span></button>)}</nav>
    {!compact && <section className={styles.hero} aria-labelledby="marketplace-title">
      <div className={styles.heroCopy}><span className={styles.eyebrow}>SERVIÇOS QUE APROXIMAM PESSOAS</span><h1 id="marketplace-title">Encontre o profissional certo,<br /><em>perto de você.</em></h1><p>Conheça prestadores, explore serviços e fale diretamente com quem pode ajudar.</p><a href="#prestadores" className={styles.heroLink}>Encontre seu prestador <Icon name="arrow" /></a></div>
    </section>}
    <section id="prestadores" className={styles.directory} aria-labelledby="marketplace-results-title">
      <div className={styles.directoryHeading}><div><span className={styles.eyebrow}>VITRINES PÚBLICAS</span>{compact ? <h1 id="marketplace-results-title">Buscar serviços</h1> : <h2 id="marketplace-results-title">Prestadores para o que você precisa</h2>}<p>Explore os perfis publicados e conheça os serviços de cada profissional.</p></div><Link href="/catalogo" className={styles.textLink}>Catálogo completo <Icon name="arrow" /></Link></div>
      <div className={styles.filters}>
        <label>Buscar serviço ou prestador<input type="search" value={filters.search} onChange={event => update({search:event.target.value})} placeholder="Nome, atividade ou serviço" maxLength={160} /></label>
        <label>Cidade ou região<input value={filters.location} onChange={event => update({location:event.target.value})} placeholder="Todas as regiões" maxLength={120} /></label>
        <label>Atendimento<select value={filters.mode} onChange={event => update({mode:event.target.value})}><option value="">Todas as formas</option>{Object.entries(modes).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Ordenar<select value={filters.sort} onChange={event => update({sort:event.target.value})}><option value="az">Nome: A–Z</option><option value="za">Nome: Z–A</option></select></label>
      </div>
      <div className={styles.resultsBar}><p role="status">{results.length} {results.length === 1 ? "prestador encontrado" : "prestadores encontrados"}{filters.category !== "all" ? ` · ${marketplaceCategories.find(item => item.id === filters.category)?.label ?? "Todas as categorias"}` : ""}</p>{active && <button type="button" onClick={() => update({search:"",location:"",category:"all",mode:""})}>Limpar filtros</button>}</div>
      {results.length ? <div className={styles.cards}>{results.map(provider => {
        const services = (provider.services ?? []).filter(service => service.is_published);
        const category = marketplaceCategories.find(item => item.id !== "all" && filterMarketplace([provider],{search:"",location:"",category:item.id,mode:"",sort:"az"}).length);
        return <article className={styles.card} key={provider.id}>
          <Link href={`/prestador/${encodeURIComponent(provider.slug)}`} className={styles.cardMedia} aria-label={`Ver perfil de ${provider.display_name}`}>
            {provider.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={provider.logo_url} alt={`Logo de ${provider.display_name}`} loading="lazy" />
            ) : <span className={styles.cardFallback}><Icon name={category?.icon ?? "tool"} /><span>{provider.display_name.split(/\s+/).slice(0,2).map(word => word.charAt(0)).join("")}</span></span>}
            <span className={styles.activityBadge}>{provider.business_type || category?.label || "Serviços"}</span>
          </Link>
          <div className={styles.cardBody}><h3><Link href={`/prestador/${encodeURIComponent(provider.slug)}`}>{provider.display_name}</Link></h3><p className={styles.cardLocation}><Icon name="pin" />{provider.service_area || provider.address || "Consulte a região atendida"}</p><p className={styles.cardDescription}>{provider.description || "Conheça os serviços deste prestador e solicite um orçamento pela Vitrine."}</p><div className={styles.cardTags}>{(provider.service_modes ?? []).map(mode => <span key={mode}>{modes[mode] ?? mode}</span>)}</div>{services.length > 0 && <p className={styles.serviceSummary}>{services.slice(0,2).map(service => service.name).join(" · ")}{services.length > 2 ? ` +${services.length-2}` : ""}</p>}<Link href={`/prestador/${encodeURIComponent(provider.slug)}`} className={styles.profileLink}>Ver perfil e serviços <Icon name="arrow" /></Link></div>
        </article>;
      })}</div> : <div className={styles.empty}><Icon name="search" /><h3>{active ? "Nenhum prestador com esses filtros" : "As primeiras vitrines estão chegando"}</h3><p>{active ? "Tente outra categoria, serviço ou região para ampliar sua busca." : "Os prestadores aparecerão aqui assim que publicarem suas Vitrines."}</p>{active ? <button className={styles.primaryButton} type="button" onClick={() => update({search:"",location:"",category:"all",mode:""})}>Ver todos os prestadores</button> : <Link className={styles.primaryButton} href="/sistema/login?cadastro=1">Quero divulgar meus serviços</Link>}</div>}
      <p className={styles.directoryNote}>As regiões, serviços e formas de atendimento são informados por cada prestador.</p>
    </section>
    {!compact && <section className={styles.providerInvite}><div><span className={styles.eyebrow}>SEU TRABALHO MERECE SER ENCONTRADO</span><h2>Você presta serviços?</h2><p>Conheça o ServiçoFácil e crie a Vitrine do seu negócio.</p></div><Link className={styles.primaryButton} href="/sistema/login?cadastro=1">Sou prestador <Icon name="arrow" /></Link><Link className={styles.textLink} href="/solucoes#para-prestadores">Conhecer a plataforma</Link></section>}
  </main>;
}
