
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VALLEX | SERVIÇOFÁCIL",
  description:
    "Soluções em informática, elétrica e tecnologia para pessoas e empresas.",

  applicationName: "VALLEX | SERVIÇOFÁCIL",

  keywords: [
    "Vallex",
    "Serviço Fácil",
    "Informática",
    "Elétrica",
    "Tecnologia",
    "Soluções digitais",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
