import Link from "next/link";
import TrafficResultsPanel from "./traffic-results-panel";

export const metadata = { title: "Resultados de campanhas | Administração VALLEX", robots: { index: false, follow: false } };

export default function TrafficResultsPage() {
  return <main className="vallex-admin-page"><div className="vallex-admin-shell">
    <header className="vallex-admin-header"><div><Link href="/admin" className="vallex-admin-brand">VALLEX <span>ADMINISTRAÇÃO</span></Link><h1>Resultados das campanhas</h1><p>Acompanhe a evolução dos indicadores por cliente, campanha e período.</p></div><div className="vallex-admin-header-actions"><Link href="/admin/trafego" className="vallex-admin-back">Voltar à gestão</Link></div></header>
    <TrafficResultsPanel />
  </div></main>;
}
