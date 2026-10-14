
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";

export default function Header() {
  const pathname = usePathname();

  function isCurrentPage(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/servicos" && pathname.startsWith("/prestador/")) return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="site-header">
      <div className="container header-content">

        <Link href="/" className="brand" aria-label="VALLEX - Página inicial">
          <Image
            src="/vallex-logo.png"
            alt="VALLEX"
            width={7271}
            height={5879}
            priority
            className="brand-logo"
          />
          <span className="brand-subtitle">SERVIÇOFÁCIL</span>
        </Link>

        <nav aria-label="Navegação principal">
          <ul className="nav-list">
            {siteConfig.navigation.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={isCurrentPage(item.href) ? "is-active" : undefined}
                  aria-current={isCurrentPage(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <Link href="/sistema/login" className="button button-outline">
            Área do prestador
          </Link>
          <Link href="/contato" className="button button-primary">
            Solicitar orçamento
          </Link>
        </div>

      </div>
    </header>
  );
}
