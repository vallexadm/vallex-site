"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Entry = { id: string; entry_type: "income" | "expense"; category: string; description: string; amount: number | string; entry_date: string; due_date: string | null; status: "paid" | "pending" | "canceled"; payment_method: string; sales_client_id: string | null; notes: string | null; source?: "manual" | "asaas"; asaas_type?: string | null; asaas_transaction_id?: string | null };
type Sale = { id: string; contact_name: string; company_name: string | null; product: string; product_scope: string | null; stage: string; contract_start_date: string | null; contract_end_date: string | null; setup_value: number | string | null; monthly_value: number | string | null };
type BankRow = { id?: string; value?: number; balance?: number; type?: string; date?: string; description?: string; paymentId?: string; transferId?: string; billId?: string };
type FinanceData = { ok: boolean; entries: Entry[]; sales: Sale[]; asaas: { configured: boolean; balance: number | null; transactions: BankRow[]; message: string }; asaasSalesAvailable: boolean; period: { from: string; to: string }; permissions: { finance?: { view?: boolean; edit?: boolean; delete?: boolean } } };
type Draft = { entry_type: "income" | "expense"; category: string; description: string; amount: string; entry_date: string; due_date: string; status: "paid" | "pending"; payment_method: string; sales_client_id: string; notes: string };

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const productNames: Record<string, string> = { trafego_pago: "Tráfego pago", servicofacil: "Plano ServiçoFácil", site_institucional: "Site institucional", desenvolvimento_web: "Desenvolvimento web / sistema", planilha_automatizada: "Planilha automatizada", consultoria: "Consultoria digital", outro: "Outro produto VALLEX" };
const stageNames: Record<string, string> = { novo: "Novo", contato: "Contato feito", qualificacao: "Qualificação", proposta: "Proposta enviada", aguardando_decisao: "Aguardando decisão", negociacao: "Em negociação", ganho: "Fechado / ganho", perdido: "Perdido" };
const categories: Record<Draft["entry_type"], string[]> = {
  income: ["Planos ServiçoFácil", "Gestão de tráfego pago", "Planilha automatizada", "Serviços VALLEX", "Outra receita"],
  expense: ["Crédito e aplicações", "Software e inteligência artificial", "Tráfego pago da VALLEX", "Internet e telefonia", "Sangria e retirada", "Infraestrutura e hospedagem", "Impostos e tarifas", "Equipamentos e materiais", "Outro gasto"],
};
const asaasCategories = ["Receita Asaas", "Despesa via Asaas", ...categories.income, ...categories.expense, "Impostos e tarifas"];
const today = new Date().toISOString().slice(0, 10);
const thisMonth = `${today.slice(0, 8)}01`;
const emptyDraft = (): Draft => ({ entry_type: "expense", category: "Software e inteligência artificial", description: "", amount: "", entry_date: today, due_date: "", status: "pending", payment_method: "outro", sales_client_id: "", notes: "" });

function asCurrency(value: unknown) { return brl.format(Number(value) || 0); }
function asDate(value?: string | null) { return value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—"; }
function isCredit(type = "") {
  const value = type.toUpperCase();
  return value === "CREDIT" || value.includes("CREDIT") || value.includes("RECEIVED") || value.includes("REVERSAL") || value.includes("REFUND_CANCELLATION") || value.includes("CASHBACK");
}
function parseBrl(value: string) { return Number(value.trim().replace(/\s|R\$/gi, "").replace(/\./g, "").replace(",", ".")); }

export default function FinanceAdmin() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [editingManualId, setEditingManualId] = useState("");
  const [from, setFrom] = useState(thisMonth);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "transactions" | "sales">("overview");
  const [query, setQuery] = useState("");
  const canEdit = data?.permissions?.finance?.edit === true;
  const canDelete = data?.permissions?.finance?.delete === true;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch(`/api/admin/financeiro?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível carregar o Financeiro VALLEX.");
      setData(result as FinanceData);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Falha ao carregar o financeiro."); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const filteredEntries = useMemo(() => (data?.entries ?? []).filter((entry) => `${entry.description} ${entry.category} ${entry.notes ?? ""}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [data, query]);
  const asaasCredits = useMemo(() => (data?.asaas.transactions ?? []).filter((row) => isCredit(row.type)).reduce((sum, row) => sum + Math.abs(Number(row.value) || 0), 0), [data]);
  const asaasDebits = useMemo(() => (data?.asaas.transactions ?? []).filter((row) => !isCredit(row.type)).reduce((sum, row) => sum + Math.abs(Number(row.value) || 0), 0), [data]);
  const manualExpenses = useMemo(() => (data?.entries ?? []).filter((entry) => entry.source !== "asaas" && entry.entry_type === "expense" && entry.status === "paid").reduce((sum, entry) => sum + Number(entry.amount), 0), [data]);
  const pendingEntries = useMemo(() => (data?.entries ?? []).filter((entry) => entry.source !== "asaas" && entry.status === "pending").reduce((sum, entry) => sum + Number(entry.amount), 0), [data]);
  const activeSales = useMemo(() => (data?.sales ?? []).filter((sale) => sale.stage === "ganho" && (!sale.contract_start_date || sale.contract_start_date <= today) && (!sale.contract_end_date || sale.contract_end_date >= today)), [data]);
  const contractedMonthly = activeSales.reduce((sum, sale) => sum + Number(sale.monthly_value ?? 0), 0);
  const pipeline = (data?.sales ?? []).filter((sale) => ["proposta", "aguardando_decisao", "negociacao"].includes(sale.stage));
  const expectedPipeline = pipeline.reduce((sum, sale) => sum + Number(sale.setup_value ?? 0) + Number(sale.monthly_value ?? 0), 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/admin/financeiro", { method: editingManualId ? "PATCH" : "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, id: editingManualId || undefined, amount: parseBrl(draft.amount), sales_client_id: draft.sales_client_id || null, due_date: draft.due_date || null }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível registrar a movimentação.");
      setDraft(emptyDraft()); setEditingManualId(""); setMessage(editingManualId ? "Lançamento atualizado." : "Movimentação registrada no Financeiro VALLEX."); await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  }

  async function updateEntry(entry: Entry, changes: { status?: string; deleted?: boolean; category?: string; description?: string }) {
    setError(""); setMessage("");
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/admin/financeiro", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: entry.id, ...changes }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível atualizar.");
      await load();
    } catch (updateError) { setError(updateError instanceof Error ? updateError.message : "Falha ao atualizar."); }
  }

  function editManualEntry(entry: Entry) {
    setDraft({ entry_type: entry.entry_type, category: entry.category, description: entry.description, amount: Number(entry.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), entry_date: entry.entry_date, due_date: entry.due_date ?? "", status: entry.status === "paid" ? "paid" : "pending", payment_method: entry.payment_method === "asaas" ? "outro" : entry.payment_method, sales_client_id: entry.sales_client_id ?? "", notes: entry.notes ?? "" });
    setEditingManualId(entry.id); setTab("overview"); setMessage(""); setError("");
  }

  if (error && !data && !loading) return <section className="vallex-admin-section"><p className="vallex-admin-error">{error}</p>{error.includes("A estrutura do Financeiro VALLEX") && <p>Execute <code>supabase/financeiro_vallex.sql</code> no Supabase de teste e tente novamente.</p>}<button className="vallex-admin-secondary" type="button" onClick={() => void load()}>Tentar novamente</button></section>;

  return <>
    {error && <p className="vallex-admin-error" role="alert">{error}</p>}{message && <p className="traffic-admin-notice" role="status">{message}</p>}
    <section className="vallex-admin-section">
      <div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Financeiro da empresa</span><h2>Resumo de caixa e operação</h2><p>O saldo disponível vem do Asaas. Lançamentos do sistema, despesas fora da conta e valores comerciais aparecem identificados por origem.</p></div><div className="vallex-admin-header-actions"><label>De <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Até <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="vallex-admin-secondary" type="button" onClick={() => void load()} disabled={loading}>{loading ? "Atualizando…" : "Atualizar dados"}</button></div></div>
      <div className="vallex-admin-metrics">
        <article><span>Saldo disponível no Asaas</span><strong>{data?.asaas.balance === null || data?.asaas.balance === undefined ? "—" : asCurrency(data.asaas.balance)}</strong><small>{data?.asaas.configured ? "Consultado diretamente no Asaas" : "Integração Asaas não configurada"}</small></article>
        <article><span>Entradas no período · Asaas</span><strong>{asCurrency(asaasCredits)}</strong><small>{data?.asaas.transactions.filter((row) => isCredit(row.type)).length ?? 0} movimentação(ões) de crédito</small></article>
        <article><span>Saídas no período · Asaas</span><strong>{asCurrency(asaasDebits)}</strong><small>Inclui despesas, tarifas e transferências</small></article>
        <article><span>Despesas pagas fora do Asaas</span><strong>{asCurrency(manualExpenses)}</strong><small>Registros manuais no período</small></article>
        <article><span>Contas manuais pendentes</span><strong>{asCurrency(pendingEntries)}</strong><small>Despesas e recebimentos ainda em aberto</small></article>
        <article><span>Receita mensal contratada</span><strong>{asCurrency(contractedMonthly)}</strong><small>{activeSales.length} contrato(s) ativo(s) em Vendas</small></article>
        <article><span>Propostas e negociações</span><strong>{asCurrency(expectedPipeline)}</strong><small>{pipeline.length} oportunidade(s); implantação + 1ª mensalidade prevista</small></article>
      </div>
    </section>

    <nav className="vallex-admin-tabs" aria-label="Seções do financeiro"><button type="button" className={tab === "overview" ? "is-active" : ""} onClick={() => setTab("overview")}>Visão geral</button><button type="button" className={tab === "transactions" ? "is-active" : ""} onClick={() => setTab("transactions")}>Extrato Asaas e lançamentos</button><button type="button" className={tab === "sales" ? "is-active" : ""} onClick={() => setTab("sales")}>Vendas e contratos</button></nav>

    {tab === "overview" && <section className="vallex-admin-section">
      <div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Despesas e receitas fora do extrato</span><h2>{editingManualId ? "Editar lançamento manual" : "Registrar movimentação manual"}</h2><p>Use para gastos pagos por outra conta ou despesas previstas. Recebimentos e pagamentos feitos no Asaas já aparecem no extrato acima; evite lançá-los novamente.</p></div></div>
      {!canEdit && <p className="vallex-admin-muted">Seu acesso permite consulta. Peça ao proprietário a permissão “Editar dados financeiros” para registrar ou atualizar lançamentos.</p>}
      <form className="vallex-admin-support-filters" onSubmit={(event) => void submit(event)}>
        <label>Tipo<select disabled={!canEdit} value={draft.entry_type} onChange={(event) => { const entry_type = event.target.value as Draft["entry_type"]; setDraft((current) => ({ ...current, entry_type, category: categories[entry_type][0] })); }}><option value="expense">Despesa</option><option value="income">Receita fora do Asaas</option></select></label>
        <label>Categoria<select disabled={!canEdit} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>{categories[draft.entry_type].map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Descrição<input disabled={!canEdit} required maxLength={180} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Ex.: mensalidade do ChatGPT" /></label>
        <label>Valor (R$)<input disabled={!canEdit} required inputMode="decimal" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value.replace(/[^\d.,]/g, "") }))} placeholder="0,00" /></label>
        <label>Data<input disabled={!canEdit} type="date" required value={draft.entry_date} onChange={(event) => setDraft((current) => ({ ...current, entry_date: event.target.value }))} /></label>
        <label>Vencimento (opcional)<input disabled={!canEdit} type="date" value={draft.due_date} onChange={(event) => setDraft((current) => ({ ...current, due_date: event.target.value }))} /></label>
        <label>Situação<select disabled={!canEdit} value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as Draft["status"] }))}><option value="pending">Pendente</option><option value="paid">Pago / recebido</option></select></label>
        <label>Forma de pagamento<select disabled={!canEdit} value={draft.payment_method} onChange={(event) => setDraft((current) => ({ ...current, payment_method: event.target.value }))}><option value="outro">Outra / fora do Asaas</option><option value="pix">Pix</option><option value="transferencia">Transferência</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="boleto">Boleto</option></select></label>
        <label>Vincular a venda (opcional)<select disabled={!canEdit} value={draft.sales_client_id} onChange={(event) => setDraft((current) => ({ ...current, sales_client_id: event.target.value }))}><option value="">Sem vínculo comercial</option>{(data?.sales ?? []).map((sale) => <option key={sale.id} value={sale.id}>{sale.company_name || sale.contact_name} · {productNames[sale.product] ?? sale.product}</option>)}</select></label>
        <label className="md:col-span-2">Observações<input disabled={!canEdit} maxLength={2000} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Detalhes úteis para a conferência" /></label>
        <div className="flex items-end gap-2"><button className="vallex-admin-primary" type="submit" disabled={!canEdit || saving}>{saving ? "Salvando…" : editingManualId ? "Salvar alterações" : "Registrar movimentação"}</button>{editingManualId && <button className="vallex-admin-back" type="button" onClick={() => { setEditingManualId(""); setDraft(emptyDraft()); }}>Cancelar edição</button>}</div>
      </form>
    </section>}

    {tab === "transactions" && <div className="grid gap-5 xl:grid-cols-2">
      <section className="vallex-admin-section"><div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Conta VALLEX</span><h2>Movimentações do Asaas</h2><p>Extrato oficial do período. Você pode classificar cada lançamento para facilitar o acompanhamento.</p></div></div>{data?.asaas.message && <p className="vallex-admin-error">{data.asaas.message}</p>}{data?.entries.filter((entry) => entry.source === "asaas").length ? <div className="vallex-admin-table-wrap"><table className="vallex-admin-table"><thead><tr><th>Data</th><th>Movimentação</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>{data.entries.filter((entry) => entry.source === "asaas").map((entry) => <tr key={entry.id}><td>{asDate(entry.entry_date)}</td><td><strong>{entry.description}</strong><small>{entry.asaas_type ?? entry.asaas_transaction_id}</small></td><td><select aria-label={`Categoria de ${entry.description}`} disabled={!canEdit} value={entry.category} onChange={(event) => void updateEntry(entry, { category: event.target.value, description: entry.description })}>{[...new Set([entry.category, ...asaasCategories])].map((category) => <option key={category}>{category}</option>)}</select></td><td className={entry.entry_type === "income" ? "text-emerald-300" : "text-rose-300"}>{entry.entry_type === "income" ? "+ " : "− "}{asCurrency(entry.amount)}</td></tr>)}</tbody></table></div> : <p className="vallex-admin-empty">{loading ? "Carregando extrato…" : "Nenhuma movimentação no período selecionado."}</p>}</section>
      <section className="vallex-admin-section"><div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Livro manual VALLEX</span><h2>Outros lançamentos</h2><p>Despesas e receitas fora do extrato do Asaas.</p></div><input aria-label="Buscar lançamento" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar lançamento" /></div>{filteredEntries.filter((entry) => entry.source !== "asaas").length ? <div className="vallex-admin-table-wrap"><table className="vallex-admin-table"><thead><tr><th>Data / vencimento</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{filteredEntries.filter((entry) => entry.source !== "asaas").map((entry) => <tr key={entry.id}><td>{asDate(entry.entry_date)}<small>Venc.: {asDate(entry.due_date)}</small></td><td><strong>{entry.description}</strong><small>{entry.category}{entry.notes ? ` · ${entry.notes}` : ""}</small></td><td>{entry.entry_type === "income" ? "Receita" : "Despesa"}</td><td>{entry.entry_type === "income" ? "+ " : "− "}{asCurrency(entry.amount)}</td><td><span className="vallex-admin-badge">{entry.status === "paid" ? "Pago / recebido" : entry.status === "pending" ? "Pendente" : "Cancelado"}</span></td><td><div className="flex flex-wrap gap-2">{canEdit && entry.status !== "canceled" && <button className="vallex-admin-secondary" type="button" onClick={() => editManualEntry(entry)}>Editar</button>}{canEdit && entry.status === "pending" && <button className="vallex-admin-secondary" type="button" onClick={() => void updateEntry(entry, { status: "paid" })}>Marcar pago</button>}{canDelete && <button className="vallex-admin-back" type="button" onClick={() => void updateEntry(entry, { deleted: true })}>Excluir</button>}</div></td></tr>)}</tbody></table></div> : <p className="vallex-admin-empty">Nenhum lançamento manual no período.</p>}</section>
    </div>}

    {tab === "sales" && <section className="vallex-admin-section"><div className="vallex-admin-section-heading"><div><span className="vallex-admin-eyebrow">Integração com Vendas VALLEX</span><h2>Contratos e oportunidades</h2><p>Os valores registrados em Vendas aparecem aqui como receita contratada ou previsão comercial. O valor só entra como recebimento quando confirmado no Asaas ou lançado como recebido.</p></div><Link href="/admin/vendas" className="vallex-admin-secondary">Abrir Vendas VALLEX</Link></div>{!data?.asaasSalesAvailable && <p className="vallex-admin-error">Aplique também supabase/vendas_vallex.sql para carregar os cadastros comerciais.</p>}{data?.sales.length ? <div className="vallex-admin-table-wrap"><table className="vallex-admin-table"><thead><tr><th>Cliente / empresa</th><th>Produto</th><th>Etapa</th><th>Implantação</th><th>Mensalidade</th><th>Contrato</th><th>Previsão</th></tr></thead><tbody>{data.sales.map((sale) => <tr key={sale.id}><td><strong>{sale.company_name || sale.contact_name}</strong><small>{sale.contact_name}</small></td><td>{productNames[sale.product] ?? sale.product}<small>{sale.product_scope ?? ""}</small></td><td><span className="vallex-admin-badge">{stageNames[sale.stage] ?? sale.stage}</span></td><td>{asCurrency(sale.setup_value)}</td><td>{asCurrency(sale.monthly_value)}</td><td>{asDate(sale.contract_start_date)} – {asDate(sale.contract_end_date)}</td><td>{sale.stage === "ganho" ? "Contratado" : ["proposta", "aguardando_decisao", "negociacao"].includes(sale.stage) ? "Em negociação" : "Cadastro comercial"}</td></tr>)}</tbody></table></div> : <p className="vallex-admin-empty">Ainda não há vendas registradas.</p>}</section>}
    <p className="vallex-admin-muted">O extrato mostra todas as movimentações da conta Asaas. Lançamentos manuais ajudam a controlar itens pagos fora dessa conta; vendas exibem valores previstos e contratados sem somá-los como dinheiro recebido.</p>
  </>;
}
