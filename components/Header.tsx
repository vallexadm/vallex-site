
import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function Header() {
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
                <Link href={item.href}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Link href="/contato" className="button button-primary">
          Solicitar orçamento
        </Link>

      </div>
    </header>
  );
}
