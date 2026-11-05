import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "VALLEX ServiçoFácil",
    short_name: "ServiçoFácil",
    description: "Encontre serviços e solicite orçamentos.",
    lang: "pt-BR",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#17002e",
    icons: [192, 512].map(size => ({
      src: "/servicofacil-" + size + ".png",
      sizes: size + "x" + size,
      type: "image/png",
    })),
  };
}
