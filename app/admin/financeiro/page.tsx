import Link from "next/link";
import FinanceAdmin from "./finance-admin";

export default function AdminFinanceiroPage() {
  return <main className="vallex-admin-page"><div className="vallex-admin-shell">
    <header className="vallex-admin-header">
      <div><Link href="/admin" className="vallex-admin-brand">VALLEX <span>ADMINISTRAÇÃO</span></Link><h1>Financeiro VALLEX</h1><p>Saldo e extrato Asaas, despesas da operação e previsão dos contratos comerciais.</p></div>
      <div className="vallex-admin-header-actions"><Link href="/admin" className="vallex-admin-back">Voltar ao admin</Link><Link href="/admin/vendas" className="vallex-admin-secondary">Abrir Vendas VALLEX</Link></div>
    </header>
    <FinanceAdmin />
  </div></main>;
}
