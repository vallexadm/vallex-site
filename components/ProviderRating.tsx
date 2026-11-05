import type { ProviderRating } from "@/lib/provider-ratings";

const ratingFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export default function ProviderRating({ rating }: { rating?: ProviderRating | null }) {
  if (rating === undefined) return null;
  if (!rating) return <p>Sem avaliações ainda</p>;

  return <p><span aria-hidden="true" className="text-amber-600">★ </span><strong>{ratingFormat.format(rating.average)} de 5</strong> · {rating.count} {rating.count === 1 ? "avaliação" : "avaliações"}</p>;
}