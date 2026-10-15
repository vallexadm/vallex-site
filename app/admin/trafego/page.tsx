import Link from "next/link";
import TrafficAdminPanel from "./traffic-admin-panel";

export const metadata = { title: "Tráfego pago | Administração VALLEX", robots: { index: false, follow: false } };

export default function AdminTrafegoPage() {
  return <main className="vallex-admin-page"><div className="vallex-admin-shell">
    <header className="vallex-admin-header"><div><Link href="/admin" className="vallex-admin-brand">VALLEX <span>ADMINISTRAÇÃO</span></Link><h1>Gestão de tráfego pago</h1><p>Vitrine de planos, contatos, negociações e indicadores de campanha.</p></div><div className="vallex-admin-header-actions"><Link href="/admin" className="vallex-admin-back">Voltar ao admin</Link><Link href="/trafego-pago" target="_blank" rel="noopener noreferrer" className="vallex-admin-secondary">Abrir página pública ↗</Link></div></header>
    <TrafficAdminPanel />
  </div></main>;
}
