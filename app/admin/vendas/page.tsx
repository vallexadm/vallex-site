import Link from "next/link";
import SalesAdmin from "./sales-admin";

export const metadata = { title: "Vendas VALLEX | Administração", robots: { index: false, follow: false } };

export default function AdminVendasPage() {
  return <main className="vallex-admin-page"><div className="vallex-admin-shell">
    <header className="vallex-admin-header"><div><Link href="/admin" className="vallex-admin-brand">VALLEX <span>ADMINISTRAÇÃO</span></Link><h1>Vendas VALLEX</h1><p>Cadastre clientes, registre oportunidades e acompanhe a negociação dos produtos VALLEX.</p></div><div className="vallex-admin-header-actions"><Link href="/admin" className="vallex-admin-back">Voltar ao admin</Link></div></header>
    <SalesAdmin />
  </div></main>;
}
