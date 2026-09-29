
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
          <h3>Institucional</h3>
          <Link href="/sobre">Sobre a Vallex</Link>
          <Link href="/servicos">Serviços</Link>
          <Link href="/privacidade">Privacidade</Link>
        </div>

        <div>
          <h3>Contato</h3>
          <p>{siteConfig.contact.email || "E-mail comercial"}</p>
          <p>{siteConfig.contact.phone || "Telefone comercial"}</p>
        </div>

      </div>

      <div className="container footer-bottom">
        © {new Date().getFullYear()} VALLEX | SERVIÇOFÁCIL.
        Todos os direitos reservados.
      </div>
    </footer>
  );
}
