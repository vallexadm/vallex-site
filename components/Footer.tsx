
import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-content">
        <div>
          <h2>VALLEX</h2>
          <p>SERVIÇOFÁCIL</p>
          <p>
            Tecnologia e soluções ao seu alcance.
          </p>
        </div>

        <div>
          <h3>Área administrativa</h3>
          <Link href="/trafego-pago">Tráfego pago</Link>
          <Link href="/admin">Administração VALLEX</Link>
        </div>

        <div>
          <h3>Institucional e ajuda</h3>
          <Link href="/sobre">Sobre a Vallex</Link>
          <Link href="/servicos">Serviços</Link>
          <Link href="/faq">Perguntas frequentes</Link>
          <Link href="/termos">Termos de Uso</Link>
          <Link href="/privacidade">Política de Privacidade</Link>
        </div>

        <div>
          <h3>Redes sociais</h3>
          <div className="social-links">
            <a href={siteConfig.social.facebook} target="_blank" rel="noopener noreferrer">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.5 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3.1c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6v2H6.7v3.2h2.9V21h3.9Z" />
              </svg>
              Facebook
            </a>
            <a href={siteConfig.social.instagram} target="_blank" rel="noopener noreferrer">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.8" r=".8" fill="currentColor" stroke="none" />
              </svg>
              Instagram
            </a>
          </div>
        </div>

        <div>
          <h3>Contato</h3>
          <a href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a>
          <a href={`tel:${siteConfig.contact.phone.replace(/[^+\d]/g, "")}`}>{siteConfig.contact.phone}</a>
        </div>

      </div>

      <div className="container footer-bottom">
        <p>
          {siteConfig.legal.companyName} · CNPJ {siteConfig.legal.cnpj}
        </p>
        <p>
          Endereço comercial para identificação e contato (sem atendimento presencial): {siteConfig.legal.businessAddress}
        </p>
        © {new Date().getFullYear()} VALLEX | SERVIÇOFÁCIL.
        Todos os direitos reservados.
      </div>
    </footer>
  );
}
