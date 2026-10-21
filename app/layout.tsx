
import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/seo";
import "./globals.css";
import FormValidation from "@/components/FormValidation";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "VALLEX | ServiçoFácil em Goiânia",
  description:
    "Encontre prestadores de serviços em Goiânia e região na Vitrine Pública do ServiçoFácil da VALLEX.",

  applicationName: "VALLEX | SERVIÇOFÁCIL",

  keywords: [
    "Vallex",
    "Serviço Fácil",
    "prestadores de serviços em Goiânia",
    "eletricista em Goiânia",
    "barbearia em Goiânia",
    "assistência para geladeira em Goiânia",
    "ServiçoFácil VALLEX",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body><FormValidation />{children}</body>
    </html>
  );
}
