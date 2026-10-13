
"use client";

import Link from "next/link";
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
          <span className="brand-name">VALLEX</span>
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
