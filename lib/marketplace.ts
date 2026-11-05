import type { PublicProvider } from "./public-providers";

export const marketplaceCategories = [
  { id: "all", label: "Todos", icon: "grid", terms: [] },
  { id: "refrigeracao", label: "Refrigeração", icon: "snow", terms: ["refriger", "ar condicionado", "geladeira", "freezer", "climatiza"] },
  { id: "beleza", label: "Beleza", icon: "scissors", terms: ["barbe", "cabeleir", "beleza", "estetica", "manicure", "salao"] },
  { id: "reformas", label: "Reformas", icon: "tool", terms: ["reforma", "pedreir", "pintura", "eletric", "hidraulic", "encanador", "marcen", "reparo"] },
  { id: "limpeza", label: "Limpeza", icon: "sparkles", terms: ["limpeza", "faxina", "diarista", "higieniza"] },
  { id: "tecnologia", label: "Tecnologia", icon: "monitor", terms: ["informatica", "tecnologia", "computador", "notebook", "redes", "software", "celular", "digital"] },
  { id: "imoveis", label: "Imóveis", icon: "home", terms: ["imove", "imobili", "corretor", "corretagem"] },
  { id: "automotivo", label: "Automotivo", icon: "car", terms: ["automotiv", "mecanica", "veiculo", "automove", "funilar", "borrachar"] },
] as const;

export function normalizeMarketplace(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export type MarketplaceFilters = { search: string; location: string; category: string; mode: string; sort: string };

export function compareProviderRatings(a: PublicProvider, b: PublicProvider) {
  return (b.rating?.average ?? 0) - (a.rating?.average ?? 0)
    || (b.rating?.count ?? 0) - (a.rating?.count ?? 0)
    || a.display_name.localeCompare(b.display_name, "pt-BR")
    || a.id.localeCompare(b.id);
}

export function filterMarketplace(providers: PublicProvider[], filters: MarketplaceFilters) {
  const search = normalizeMarketplace(filters.search);
  const location = normalizeMarketplace(filters.location);
  const category = marketplaceCategories.find(item => item.id === filters.category);
  const matches = providers.filter(provider => {
    // A vitrine inicial nunca transforma perfis privados em anúncios públicos.
    if (!provider.is_published || provider.is_preview) return false;
    const services = (provider.services ?? []).filter(service => service.is_published);
    const activity = normalizeMarketplace([provider.business_type, ...services.map(service => service.name)].filter(Boolean).join(" "));
    const fullText = normalizeMarketplace([provider.display_name, provider.description, provider.service_area, provider.address, activity, ...services.map(service => service.description)].filter(Boolean).join(" "));
    if (search && !fullText.includes(search)) return false;
    if (location && !normalizeMarketplace(provider.service_area || provider.address || "").includes(location)) return false;
    if (filters.mode && !(provider.service_modes ?? []).includes(filters.mode)) return false;
    if (category && category.id !== "all" && !category.terms.some(term => activity.includes(term))) return false;
    return true;
  });
  return matches.sort((a, b) => {
    const byName = a.display_name.localeCompare(b.display_name, "pt-BR");
    if (filters.sort === "az") return byName;
    if (filters.sort === "za") return -byName;
    return compareProviderRatings(a, b);
  });
}

export function marketplaceFiltersFromParams(params: URLSearchParams): MarketplaceFilters {
  const sort = params.get("ordem");
  const category = params.get("categoria") ?? "all";
  const location = params.get("localidade") ?? "";
  return { search: params.get("buscar") ?? "", location: location === "todas" ? "" : location, category: marketplaceCategories.some(item => item.id === category) ? category : "all", mode: params.get("atendimento") ?? "", sort: sort === "az" || sort === "za" ? sort : "rating" };
}
