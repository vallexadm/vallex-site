"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import SystemBrand from "@/components/SystemBrand";
import CurrencyInput from "@/components/CurrencyInput";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { calculateFuelCost, describeFuelCost, type FuelCostDetails } from "@/lib/fuel-cost";
import { normalizeMemberPermissions, type MemberPermissions } from "@/lib/team-permissions";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import { completePaymentRequest, getPaymentRequestId } from "@/lib/payment-request";

type Customer = { id: string; name: string };
type ServicePayment = {
  id: string;
  installment_number: number;
  payment_method: string;
  payment_date: string;
  amount: number | string;
};
type ScheduledInstallment = { id: string; installment_number: number; due_date: string; amount: number | string };
type ScheduledInstallmentDraft = { installment_number: number; due_date: string; amount: string };
type ServiceCostItem = { id: string; category: string; description: string; amount: number | string };
type AuditAction = "created" | "updated" | "deleted" | "payment_registered";
type FinanceAuditEvent = { id: string; service_record_id: string | null; actor_user_id: string | null; actor_email: string | null; action: AuditAction; details: Record<string, unknown>; created_at: string };
type ServiceEditDraft = { customer_id: string; service_name: string; service_date: string; source: string; amount_charged: string; notes: string; scheduled_installments: ScheduledInstallmentDraft[] };
type InstallmentDraft = { amount: string; due_date: string };
type CostItemDraft = { category: string; description: string; amount: string };
type ServiceRecord = {
  id: string;
  charge_code: string;
  customer_id: string;
  service_name: string;
  service_date: string;
  source: string;
  amount_charged: number | string;
  amount_received: number | string;
  direct_cost: number | string;
  installments_total: number;
  payments: ServicePayment[];
  scheduled_installments: ScheduledInstallment[];
  cost_items: ServiceCostItem[];
  notes: string | null;
  customers: { id: string; name: string } | null;
};
type PaymentInPeriod = ServicePayment & {
  service_record_id: string;
  organization_service_records: { service_name: string; customers: { name: string } | null } | null;
};
type Expense = {
  id: string;
  description: string;
  category: string;
  amount: number | string;
  expense_date: string;
  due_date: string | null;
  expense_type: "avulsa" | "fixa_mensal";
  recurrence_group_id: string | null;
  classification: string;
  property_type: "alugado" | "proprio" | "nao_aplica";
  payment_status: "pago" | "pendente";
  notes: string | null;
};
type CashflowExpense = Pick<Expense, "id" | "description" | "category" | "amount" | "expense_date" | "due_date" | "payment_status">;
type FinancialIndicators = {
  total_charged: number | string;
  total_received: number | string;
  direct_costs: number | string;
  total_expenses: number | string;
  paid_expenses: number | string;
  cash_balance: number | string;
  estimated_profit: number | string;
  profit_margin: number | string;
};
type ProviderReportProfile = { display_name: string; phone: string | null; whatsapp: string | null; email: string | null; address: string | null; logo_url: string | null };
type FinanceData = { services: ServiceRecord[]; receivables: ServiceRecord[]; cashflowExpenses: CashflowExpense[]; expenses: Expense[]; customers: Customer[]; payments: PaymentInPeriod[]; indicators: FinancialIndicators | null; organizationName: string; providerProfile: ProviderReportProfile | null; permissions?: MemberPermissions };
type FinancialReportType = "resumo" | "servicos" | "recebimentos" | "despesas" | "contas_pagar" | "a_receber" | "fluxo_caixa";
type ReportCell = string | number;

const financialReportDefinitions: Record<FinancialReportType, { label: string; headers: string[] }> = {
  resumo: { label: "Resumo financeiro", headers: ["Indicador", "Valor"] },
  servicos: { label: "Serviços realizados", headers: ["Data", "Cliente", "Serviço", "Origem", "Cobrado", "Recebido", "Custo direto", "Resultado direto", "Margem (%)", "Plano"] },
  recebimentos: { label: "Recebimentos", headers: ["Data", "Cliente", "Serviço", "Parcela", "Meio de pagamento", "Valor"] },
  despesas: { label: "Despesas", headers: ["Vencimento ou pagamento", "Descrição", "Categoria", "Classificação", "Tipo", "Situação", "Valor"] },
  contas_pagar: { label: "Contas a pagar", headers: ["Vencimento", "Descrição", "Categoria", "Classificação", "Tipo", "Valor"] },
  a_receber: { label: "Valores a receber", headers: ["Cliente", "Serviço", "Próximo vencimento", "Cobrado", "Recebido", "Saldo"] },
  fluxo_caixa: { label: "Fluxo de caixa previsto", headers: ["Vencimento", "Situação", "Cliente ou conta", "Descrição", "Movimento", "Valor previsto"] },
};

const sourceLabels: Record<string, string> = {
  vallex: "Vallex / ServiçoFácil",
  indicacao: "Indicação",
  redes_sociais: "Redes sociais",
  busca_web: "Busca na internet",
  recorrente: "Cliente recorrente",
  outros: "Outro",
};
const auditActionLabels: Record<AuditAction, string> = {
  created: "Cobrança criada",
  updated: "Cobrança editada",
  deleted: "Cobrança excluída",
  payment_registered: "Recebimento registrado",
};
const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  boleto: "Boleto",
  outro: "Outro",
};
const costCategoryLabels: Record<string, string> = {
  materiais_insumos: "Materiais e insumos",
  taxas_cartorio: "Taxas e cartório",
  transporte: "Transporte e deslocamento",
  ferramentas_equipamentos: "Ferramentas e equipamentos",
  terceirizados: "Serviços terceirizados",
  alimentacao_hospedagem: "Alimentação e hospedagem",
  outros: "Outros",
};
const expenseClassificationLabels: Record<string, string> = {
  despesa_fixa: "Despesas fixas",
  despesa_variavel: "Despesas variáveis",
  operacional: "Despesas operacionais",
  pessoal: "Despesas com pessoal",
  comercial_marketing: "Despesas comerciais e de marketing",
  nao_operacional: "Despesas não operacionais",
  financeira: "Despesas financeiras",
};
const propertyTypeLabels: Record<string, string> = { alugado: "Alugado", proprio: "Próprio", nao_aplica: "Não se aplica" };
const expenseCategories = ["Serviços de colaboradores", "Materiais e insumos", "Aluguel e espaço", "Energia elétrica", "Água", "Internet", "Transporte", "Divulgação e marketing", "Software", "Impostos e taxas", "Outros"];

function localDateValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function localMonthValue() {
  return localDateValue().slice(0, 7);
}

function monthRange(value: string) {
  const [year, month] = value.split("-").map(Number);
  return { from: `${value}-01`, to: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10) };
}

function dateAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function auditEventSummary(event: FinanceAuditEvent) {
  const details = event.details ?? {};
  const before = typeof details.before === "object" && details.before !== null ? details.before as Record<string, unknown> : {};
  const after = typeof details.after === "object" && details.after !== null ? details.after as Record<string, unknown> : {};
  if (event.action === "payment_registered") {
    const method = typeof details.payment_method === "string" ? paymentMethodLabels[details.payment_method] ?? "Outro" : "";
    const installment = Number(details.installment_number) === 0 ? "Entrada" : `${Number(details.installment_number)}ª parcela`;
    return `${formatCurrency(Number(details.amount) || 0)} · ${installment} · ${method} · pagamento em ${typeof details.payment_date === "string" ? formatDate(details.payment_date) : "—"}`;
  }
  if (event.action === "updated") {
    const changes: string[] = [];
    if (before.service_name !== after.service_name) changes.push(`Serviço: ${String(before.service_name ?? "—")} → ${String(after.service_name ?? "—")}`);
    if (Number(before.amount_charged) !== Number(after.amount_charged)) changes.push(`Valor: ${formatCurrency(Number(before.amount_charged) || 0)} → ${formatCurrency(Number(after.amount_charged) || 0)}`);
    if (before.service_date !== after.service_date) changes.push(`Data: ${String(before.service_date ?? "—")} → ${String(after.service_date ?? "—")}`);
    if (before.customer_name !== after.customer_name) changes.push(`Cliente: ${String(before.customer_name ?? "—")} → ${String(after.customer_name ?? "—")}`);
    if (JSON.stringify(before.installments ?? []) !== JSON.stringify(after.installments ?? [])) changes.push("Parcelas ou vencimentos atualizados");
    return changes.join(" · ") || "Dados da cobrança atualizados.";
  }
  const serviceName = String(details.service_name ?? after.service_name ?? before.service_name ?? "Cobrança");
  const amount = Number(details.amount_charged ?? after.amount_charged ?? before.amount_charged);
  return Number.isFinite(amount) && amount > 0 ? `${serviceName} · ${formatCurrency(amount)}` : serviceName;
}

function auditEventCustomer(event: FinanceAuditEvent) {
  const details = event.details ?? {};
  const before = typeof details.before === "object" && details.before !== null ? details.before as Record<string, unknown> : {};
  const after = typeof details.after === "object" && details.after !== null ? details.after as Record<string, unknown> : {};
  return String(details.customer_name ?? after.customer_name ?? before.customer_name ?? "—");
}

function auditEventService(event: FinanceAuditEvent) {
  const details = event.details ?? {};
  const before = typeof details.before === "object" && details.before !== null ? details.before as Record<string, unknown> : {};
  const after = typeof details.after === "object" && details.after !== null ? details.after as Record<string, unknown> : {};
  return String(details.service_name ?? after.service_name ?? before.service_name ?? "—");
}

function csvCell(value: ReportCell) {
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(2).replace(".", ",") : "";
  const safeValue = /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

function safeProviderLogoUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function getPaymentInstallments(service: ServiceRecord) {
  const serviceBalance = Math.max(0, Number(service.amount_charged) - Number(service.amount_received));
  const scheduled = [...(service.scheduled_installments ?? [])].sort((a, b) => a.installment_number - b.installment_number);
  const numbers = scheduled.length ? scheduled.map((item) => item.installment_number)
    : Array.from({ length: Math.max(1, service.installments_total || 1) }, (_, index) => index + 1);
  return numbers.map((number) => {
    const installment = scheduled.find((item) => item.installment_number === number);
    const received = (service.payments ?? []).filter((payment) => payment.installment_number === number)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const balance = Math.max(0, Math.round(Math.min(serviceBalance, installment ? Number(installment.amount) - received : serviceBalance) * 100) / 100);
    return { number, dueDate: installment?.due_date, amount: installment ? Number(installment.amount) : null, received, balance };
  });
}

function ServiceInstallments({ service }: { service: ServiceRecord }) {
  const scheduled = [...(service.scheduled_installments ?? [])].sort((a, b) => a.installment_number - b.installment_number);
  return <div className="mt-2 space-y-2 text-xs text-slate-500">
    {scheduled.map((installment) => {
      const received = (service.payments ?? []).filter((payment) => payment.installment_number === installment.installment_number)
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const balance = Math.max(0, Number(installment.amount) - received);
      return <p key={installment.id}><strong>{installment.installment_number}ª parcela</strong> · vencimento {formatDate(installment.due_date)} · {formatCurrency(Number(installment.amount))}
        <span className="block">{balance <= 0 ? `Quitada · recebido ${formatCurrency(received)}` : received > 0 ? `Parcial · recebido ${formatCurrency(received)} · falta ${formatCurrency(balance)}` : `Pendente · falta ${formatCurrency(balance)}`}</span>
      </p>;
    })}
    {(service.payments ?? []).filter((payment) => !scheduled.some((item) => item.installment_number === payment.installment_number)).map((payment) =>
      <p key={payment.id}>{payment.installment_number === 0 ? "Entrada" : `${payment.installment_number}ª parcela`} recebida · {paymentMethodLabels[payment.payment_method] ?? "Outro"} · {formatDate(payment.payment_date)} · {formatCurrency(Number(payment.amount))}</p>
    )}
  </div>;
}

export default function FinanceiroPage() {
  const paymentSavingRef = useRef(false);
  const walkInSavingRef = useRef(false);
  const collaboratorLinkApplied = useRef(false);
  const [savingWalkIn, setSavingWalkIn] = useState(false);
  const [collaborators, setCollaborators] = useState<{ id: string; name: string }[]>([]);
  const [collaboratorsWarning, setCollaboratorsWarning] = useState("");
  const [expenseCollaboratorId, setExpenseCollaboratorId] = useState("");
  const router = useRouter();
  const [filterMode, setFilterMode] = useState<"month" | "year" | "day" | "custom">("month");
  const [selectedMonth, setSelectedMonth] = useState(localMonthValue());
  const [selectedYear, setSelectedYear] = useState(localDateValue().slice(0, 4));
  const [selectedDay, setSelectedDay] = useState(localDateValue());
  const [customFrom, setCustomFrom] = useState(`${localMonthValue()}-01`);
  const [customTo, setCustomTo] = useState(localDateValue());
  const [periodRange, setPeriodRange] = useState(() => monthRange(localMonthValue()));
  const [reportType, setReportType] = useState<FinancialReportType>("resumo");
  const [serviceDate, setServiceDate] = useState(localDateValue());
  const [expenseDate, setExpenseDate] = useState(localDateValue());
  const [expenseDueDate, setExpenseDueDate] = useState(localDateValue());
  const [expenseType, setExpenseType] = useState<"avulsa" | "fixa_mensal">("avulsa");
  const [recurrenceMonths, setRecurrenceMonths] = useState("12");
  const [data, setData] = useState<FinanceData>({ services: [], receivables: [], cashflowExpenses: [], expenses: [], customers: [], payments: [], indicators: null, organizationName: "", providerProfile: null });
  const [auditEvents, setAuditEvents] = useState<FinanceAuditEvent[]>([]);
  const [auditAction, setAuditAction] = useState<"all" | AuditAction>("all");
  const [auditError, setAuditError] = useState("");
  const [canManageFinance, setCanManageFinance] = useState(false);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [source, setSource] = useState("outros");
  const [amountCharged, setAmountCharged] = useState("");
  const [amountReceived, setAmountReceived] = useState("0");
  const [initialPaymentMethod, setInitialPaymentMethod] = useState("pix");
  const [initialPaymentDate, setInitialPaymentDate] = useState(localDateValue());
  const [installmentDrafts, setInstallmentDrafts] = useState<InstallmentDraft[]>([{ amount: "", due_date: dateAfterDays(30) }]);
  const [costItemDrafts, setCostItemDrafts] = useState<CostItemDraft[]>([]);
  const [serviceNotes, setServiceNotes] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Materiais e insumos");
  const [expenseClassification, setExpenseClassification] = useState("despesa_variavel");
  const [expensePropertyType, setExpensePropertyType] = useState<"alugado" | "proprio" | "nao_aplica">("nao_aplica");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseFuel, setExpenseFuel] = useState<FuelCostDetails>({ distance_km: "", fuel_type: "gasolina", price_per_liter: "", efficiency_km_per_liter: "" });
  const [expenseStatus, setExpenseStatus] = useState<"pago" | "pendente">("pago");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [paymentServiceId, setPaymentServiceId] = useState("");
  const [paymentSource, setPaymentSource] = useState<"services" | "receivables">("services");
  const [receivableSearch, setReceivableSearch] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentInstallment, setPaymentInstallment] = useState("1");
  const [paymentInstallmentsTotal, setPaymentInstallmentsTotal] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [paymentDate, setPaymentDate] = useState(localDateValue());
  const [loading, setLoading] = useState(true);
  const [savingService, setSavingService] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState("");
  const [serviceEditDraft, setServiceEditDraft] = useState<ServiceEditDraft | null>(null);
  const [serviceEditSaved, setServiceEditSaved] = useState("");
  const [savingServiceEdit, setSavingServiceEdit] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const getToken = useCallback(async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Configuração do Supabase não encontrada.");
    const client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    const { data: sessionData } = await client.auth.getSession();
    return sessionData.session?.access_token ?? "";
  }, []);

  const loadData = useCallback(async (fromDate: string, toDate: string) => {
    setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessão não encontrada. Faça login novamente.");
      const headers = { Authorization: `Bearer ${token}` };
      const [response, receivablesResponse, auditResponse] = await Promise.all([
        fetch(`/api/sistema/financeiro?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`, { headers, cache: "no-store" }),
        fetch("/api/sistema/financeiro?cashflow=all", { headers, cache: "no-store" }),
        fetch(`/api/sistema/financeiro?audit=all&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`, { headers, cache: "no-store" }),
      ]);
      const [result, receivablesResult, auditResult] = await Promise.all([response.json(), receivablesResponse.json(), auditResponse.json()]);
      if (response.status === 401 || receivablesResponse.status === 401 || auditResponse.status === 401) {
        router.replace("/sistema/login");
        return;
      }
      if (response.status === 403 || receivablesResponse.status === 403 || auditResponse.status === 403) {
        router.replace("/sistema");
        return;
      }
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível carregar o financeiro.");
      if (!receivablesResponse.ok || !receivablesResult.ok) throw new Error(receivablesResult.message ?? "Não foi possível carregar o fluxo de caixa.");
      setAuditEvents(auditResponse.ok && auditResult.ok ? auditResult.audit_events ?? [] : []);
      setAuditError(auditResponse.ok && auditResult.ok ? "" : auditResult.message ?? "Não foi possível carregar o histórico de operações.");
      const permissions = normalizeMemberPermissions(result.permissions ?? receivablesResult.permissions);
      setCanManageFinance(permissions.finance.manage);
      setCollaborators(result.collaborators ?? []);
      setCollaboratorsWarning(result.collaborators_warning ?? "");
      const requestedCollaborator = new URLSearchParams(window.location.search).get("colaborador");
      if (requestedCollaborator && !collaboratorLinkApplied.current && permissions.finance.manage) {
        const person = (result.collaborators ?? []).find((item: { id: string }) => item.id === requestedCollaborator);
        if (person) {
          collaboratorLinkApplied.current = true;
          setExpenseCollaboratorId(person.id);
          setExpenseCategory("Serviços de colaboradores");
          setExpenseClassification("despesa_variavel");
          setExpenseDescription("Pagamento de serviço");
          setExpenseStatus("pendente");
          window.setTimeout(() => document.getElementById("registrar-conta")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
        }
      }
      setData({ services: result.services ?? [], receivables: receivablesResult.receivables ?? [], cashflowExpenses: receivablesResult.pendingExpenses ?? [], expenses: result.expenses ?? [], customers: result.customers ?? [], payments: result.payments ?? [], indicators: result.indicators ?? null, organizationName: result.organization_name ?? "", providerProfile: result.provider_profile ?? null });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o financeiro.");
    } finally {
      setLoading(false);
    }
  }, [getToken, router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void loadData(periodRange.from, periodRange.to); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData, periodRange]);

  const candidateRange = useMemo(() => {
    if (filterMode === "month") {
      const [year, monthNumber] = selectedMonth.split("-").map(Number);
      if (!year || !monthNumber) return { from: "", to: "" };
      return { from: `${selectedMonth}-01`, to: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10) };
    }
    if (filterMode === "year") return { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` };
    if (filterMode === "day") return { from: selectedDay, to: selectedDay };
    return { from: customFrom, to: customTo };
  }, [filterMode, selectedMonth, selectedYear, selectedDay, customFrom, customTo]);

  function applyDateFilter() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidateRange.from) || !/^\d{4}-\d{2}-\d{2}$/.test(candidateRange.to) || candidateRange.from > candidateRange.to) {
      setError("Confira as datas do período escolhido.");
      return;
    }
    setError("");
    setPeriodRange(candidateRange);
  }

  async function updateExpenseStatus(expense: Expense, paymentStatus: "pago" | "pendente") {
    setError("");
    setMessage("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessão não encontrada. Faça login novamente.");
      const response = await fetch("/api/sistema/financeiro", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ expense_id: expense.id, payment_status: paymentStatus, paid_date: localDateValue() }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível atualizar a conta.");
      setMessage(result.message ?? "Situação atualizada.");
      await loadData(periodRange.from, periodRange.to);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Não foi possível atualizar a conta.");
    }
  }

  const totals = useMemo(() => {
    const charged = data.services.reduce((total, item) => total + Number(item.amount_charged), 0);
    const received = data.payments.reduce((total, item) => total + Number(item.amount), 0);
    const receivable = data.services.reduce((total, item) => total + Math.max(0, Number(item.amount_charged) - Number(item.amount_received)), 0);
    const direct = data.services.reduce((total, item) => total + Number(item.direct_cost), 0);
    const expenses = data.expenses.reduce((total, item) => total + Number(item.amount), 0);
    const paidExpenses = data.expenses.filter((item) => item.payment_status === "pago").reduce((total, item) => total + Number(item.amount), 0);
    const pendingExpenses = expenses - paidExpenses;
    return {
      charged,
      received,
      receivable,
      direct,
      expenses,
      paidExpenses,
      pendingExpenses,
      pendingExpenseCount: data.expenses.filter((item) => item.payment_status === "pendente").length,
      estimatedResult: charged - direct - expenses,
      cashBalance: received - direct - paidExpenses,
      profitMargin: charged > 0 ? ((charged - direct - expenses) / charged) * 100 : 0,
    };
  }, [data]);

  const pendingBills = useMemo(() => data.expenses.filter((expense) => expense.payment_status === "pendente"), [data.expenses]);
  const paidExpensesInPeriod = useMemo(() => data.expenses.filter((expense) => expense.payment_status === "pago"), [data.expenses]);
  const filteredReceivables = useMemo(() => {
    const query = receivableSearch.trim().toLocaleLowerCase("pt-BR");
    return data.receivables.filter((service) => !query || `${service.customers?.name ?? ""} ${service.service_name}`.toLocaleLowerCase("pt-BR").includes(query));
  }, [data.receivables, receivableSearch]);
  const cashflowEntries = useMemo(() => {
    const incoming = data.receivables.flatMap((service) => {
      const balance = Math.max(0, Number(service.amount_charged) - Number(service.amount_received));
      let remaining = balance;
      const scheduled = [...(service.scheduled_installments ?? [])].sort((a, b) => a.installment_number - b.installment_number).flatMap((installment) => {
        const alreadyReceived = (service.payments ?? []).filter((payment) => payment.installment_number === installment.installment_number).reduce((sum, payment) => sum + Number(payment.amount), 0);
        const installmentBalance = Math.max(0, Number(installment.amount) - alreadyReceived);
        const amount = Math.min(remaining, installmentBalance);
        remaining -= amount;
        return amount > 0 ? [{ id: `${service.id}-${installment.id}`, due_date: installment.due_date, direction: "receber" as const, description: service.service_name, customer_name: service.customers?.name ?? null, amount }] : [];
      });
      return scheduled;
    });
    const outgoing = data.cashflowExpenses.map((expense) => ({ id: expense.id, due_date: expense.due_date ?? expense.expense_date, direction: "pagar" as const, description: expense.description, customer_name: null, amount: Number(expense.amount) }));
    return [...incoming, ...outgoing].sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [data.cashflowExpenses, data.receivables]);
  const cashflowDisplayEntries = useMemo(() => {
    const today = localDateValue();
    return cashflowEntries.filter((entry) => entry.due_date < today || (entry.due_date >= periodRange.from && entry.due_date <= periodRange.to));
  }, [cashflowEntries, periodRange]);
  const undatedReceivableTotal = useMemo(() => data.receivables.reduce((total, service) => {
    const balance = Math.max(0, Number(service.amount_charged) - Number(service.amount_received));
    const scheduledBalance = (service.scheduled_installments ?? []).reduce((sum, installment) => {
      const received = (service.payments ?? []).filter((payment) => payment.installment_number === installment.installment_number).reduce((amount, payment) => amount + Number(payment.amount), 0);
      return sum + Math.max(0, Number(installment.amount) - received);
    }, 0);
    return total + Math.max(0, balance - scheduledBalance);
  }, 0), [data.receivables]);
  const cashflowTotals = useMemo(() => cashflowDisplayEntries.reduce((totals, entry) => {
    if (entry.direction === "receber") totals.incoming += entry.amount;
    else totals.outgoing += entry.amount;
    return totals;
  }, { incoming: 0, outgoing: 0 }), [cashflowDisplayEntries]);
  const reportRows = useMemo<ReportCell[][]>(() => {
    if (reportType === "resumo") return [
      ["Faturamento", totals.charged], ["Recebido no período", totals.received], ["A receber", totals.receivable],
      ["Custos diretos", totals.direct], ["Despesas no período", totals.expenses], ["Resultado estimado", totals.estimatedResult], ["Saldo de caixa", totals.cashBalance],
    ];
    if (reportType === "servicos") return data.services.map((service) => {
      const charged = Number(service.amount_charged);
      const result = charged - Number(service.direct_cost);
      return [formatDate(service.service_date), service.customers?.name ?? "Cliente", service.service_name, sourceLabels[service.source] ?? "Outro", charged, Number(service.amount_received), Number(service.direct_cost), result, `${(charged > 0 ? (result / charged) * 100 : 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`, service.scheduled_installments?.length ? `${service.scheduled_installments.length} parcela(s)` : "À vista"];
    });
    if (reportType === "recebimentos") return data.payments.map((payment) => [formatDate(payment.payment_date), payment.organization_service_records?.customers?.name ?? "Cliente", payment.organization_service_records?.service_name ?? "Serviço", payment.installment_number === 0 ? "Entrada" : `${payment.installment_number}ª parcela`, paymentMethodLabels[payment.payment_method] ?? "Outro", Number(payment.amount)]);
    if (reportType === "despesas") return data.expenses.map((expense) => [formatDate(expense.payment_status === "pago" ? expense.expense_date : expense.due_date ?? expense.expense_date), expense.description, expense.category, expenseClassificationLabels[expense.classification] ?? "Despesas variáveis", expense.expense_type === "fixa_mensal" ? "Conta fixa" : "Avulsa", expense.payment_status === "pago" ? "Paga" : "Pendente", Number(expense.amount)]);
    if (reportType === "contas_pagar") return pendingBills.map((expense) => [formatDate(expense.due_date ?? expense.expense_date), expense.description, expense.category, expenseClassificationLabels[expense.classification] ?? "Despesas variáveis", expense.expense_type === "fixa_mensal" ? "Conta fixa" : "Avulsa", Number(expense.amount)]);
    if (reportType === "a_receber") return data.receivables.map((service) => {
      const nextInstallment = (service.scheduled_installments ?? []).find((installment) => (service.payments ?? []).filter((payment) => payment.installment_number === installment.installment_number).reduce((sum, payment) => sum + Number(payment.amount), 0) < Number(installment.amount));
      return [service.customers?.name ?? "Cliente", service.service_name, nextInstallment ? formatDate(nextInstallment.due_date) : "Sem vencimento definido", Number(service.amount_charged), Number(service.amount_received), Math.max(0, Number(service.amount_charged) - Number(service.amount_received))];
    });
    const rows: ReportCell[][] = cashflowDisplayEntries.map((entry) => [formatDate(entry.due_date), entry.due_date < localDateValue() ? "Vencido" : "Previsto", entry.customer_name ?? "", entry.description, entry.direction === "receber" ? "Entrada" : "Saída", entry.amount]);
    if (undatedReceivableTotal > 0) rows.push(["", "Sem vencimento", "Clientes", "Saldo sem vencimento definido", "Entrada", undatedReceivableTotal]);
    return rows;
  }, [reportType, totals, data.services, data.payments, data.expenses, data.receivables, pendingBills, cashflowDisplayEntries, undatedReceivableTotal]);

  const filteredAuditEvents = useMemo(
    () => auditAction === "all" ? auditEvents : auditEvents.filter((event) => event.action === auditAction),
    [auditEvents, auditAction],
  );

  function downloadFinancialReport() {
    const definition = financialReportDefinitions[reportType];
    const csv = [definition.headers, ...reportRows].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `relatorio-financeiro-${reportType}-${periodRange.from}-a-${periodRange.to}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadAuditReport() {
    const headers = ["Data e hora", "Operação", "Cliente", "Serviço", "Usuário", "Detalhes"];
    const rows = filteredAuditEvents.map((event) => [
      new Date(event.created_at).toLocaleString("pt-BR"),
      auditActionLabels[event.action],
      auditEventCustomer(event),
      auditEventService(event),
      event.actor_email ?? event.actor_user_id ?? "Não identificado",
      auditEventSummary(event),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `historico-financeiro-${periodRange.from}-a-${periodRange.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function printFinancialReport() {
    const printWindow = window.open("", "_blank", "width=1000,height=800");
    if (!printWindow) {
      setError("O navegador bloqueou a janela do relatório. Permita pop-ups para imprimir ou salvar em PDF.");
      return;
    }
    setError("");
    const definition = financialReportDefinitions[reportType];
    const headers = definition.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
    const rows = reportRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(typeof cell === "number" ? formatCurrency(cell) : cell)}</td>`).join("")}</tr>`).join("");
    const providerName = data.providerProfile?.display_name || data.organizationName || "Prestador";
    const logoUrl = safeProviderLogoUrl(data.providerProfile?.logo_url);
    const logoMarkup = logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo de ${escapeHtml(providerName)}" onerror="this.remove()">` : "";
    const providerContact = [data.providerProfile?.phone, data.providerProfile?.whatsapp ? `WhatsApp ${data.providerProfile.whatsapp}` : null, data.providerProfile?.email, data.providerProfile?.address].filter((item): item is string => Boolean(item)).map(escapeHtml).join(" · ");
    const periodLabel = reportType === "a_receber" ? "Valores em aberto, independentemente da data do serviço" : `Período aplicado: ${formatDate(periodRange.from)} a ${formatDate(periodRange.to)}`;
    const note = reportType === "resumo" || reportType === "servicos" ? "Resultado direto considera o valor cobrado menos os custos diretos registrados. Despesas gerais não são rateadas por serviço." : "Relatório gerado com os dados do período e do tipo selecionados no painel financeiro.";
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(definition.label)}</title><style>body{font:14px Arial,sans-serif;color:#172033;margin:32px}.provider{display:flex;align-items:center;gap:16px;border-bottom:1px solid #dbe2ea;padding-bottom:16px;margin-bottom:20px}.logo{width:90px;height:76px;border:1px solid #dbe2ea;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none}.logo img{width:100%;height:100%;object-fit:contain}.provider-name{font-size:18px;font-weight:bold;margin:0}.provider-contact{font-size:11px;color:#526178;margin:6px 0 0}.service-brand{font-size:10px;color:#6d28d9;letter-spacing:2px;margin:0 0 3px}h1{margin:0 0 6px;font-size:24px}.meta,.note{color:#526178;font-size:12px}.note{margin:18px 0}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #dbe2ea;padding:8px;text-align:left;vertical-align:top}th{background:#f1f5f9}tr{break-inside:avoid}footer{margin-top:20px;border-top:1px solid #e2e8f0;padding-top:10px;color:#64748b;font-size:10px}@media print{body{margin:16mm;print-color-adjust:exact}thead{display:table-header-group}}</style></head><body><header class="provider"><div class="logo">${logoMarkup}</div><div><p class="service-brand">SERVIÇOFÁCIL</p><p class="provider-name">${escapeHtml(providerName)}</p>${providerContact ? `<p class="provider-contact">${providerContact}</p>` : ""}</div></header><h1>${escapeHtml(definition.label)}</h1><p class="meta">${escapeHtml(periodLabel)}</p><p class="note">${escapeHtml(note)}</p><table><thead><tr>${headers}</tr></thead><tbody>${rows || `<tr><td colspan="${definition.headers.length}">Nenhum registro encontrado neste relatório.</td></tr>`}</tbody></table><footer>Gerado em ${escapeHtml(new Date().toLocaleString("pt-BR"))} · Documento para controle do prestador.<br>VALLEX · <a href="mailto:vallexbusiness@gmail.com">vallexbusiness@gmail.com</a> · WhatsApp (62) 98540-8497</footer></body></html>`);
    printWindow.document.close();
    printWindow.opener = null;
    window.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 350);
  }

    const plannedInstallmentTotal = installmentDrafts.reduce((total, item) => total + (parseCurrencyInput(item.amount) || 0), 0);
    const serviceDirectCost = costItemDrafts.reduce((total, item) => total + (parseCurrencyInput(item.amount) || 0), 0);
  const calculatedExpenseFuelCost = calculateFuelCost(expenseFuel);

  async function handleWalkInCustomer() {
    if (walkInSavingRef.current) return;
    walkInSavingRef.current = true; setSavingWalkIn(true); setError(""); setMessage("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessão não encontrada. Faça login novamente.");
      const response = await fetch("/api/sistema/financeiro", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "walk_in_customer" }),
      });
      const result = await response.json();
      if (!response.ok || !result.customer?.id) throw new Error(result.message ?? "Não foi possível selecionar o cliente avulso.");
      setData((current) => ({ ...current, customers: [...current.customers.filter((item) => item.id !== result.customer.id), result.customer].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) }));
      setCustomerId(result.customer.id);
      setMessage("Cliente avulso selecionado para esta cobrança.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível selecionar o cliente avulso."); }
    finally { walkInSavingRef.current = false; setSavingWalkIn(false); }
  }

  async function submitRecord(event: FormEvent<HTMLFormElement>, type: "service" | "expense") {
    event.preventDefault();
    setError("");
    setMessage("");
    if (type === "service") setSavingService(true);
    else setSavingExpense(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessão não encontrada. Faça login novamente.");
      const payload = type === "service" ? {
        type,
        customer_id: customerId,
        service_name: serviceName,
        service_date: serviceDate,
        source,
        amount_charged: amountCharged,
        amount_received: amountReceived,
        initial_payment_date: initialPaymentDate,
        payment_method: initialPaymentMethod,
        scheduled_installments: installmentDrafts.filter((item) => item.amount !== "").map((item) => ({ amount: item.amount, due_date: item.due_date })),
        cost_items: costItemDrafts.filter((item) => item.description.trim() || item.amount !== "").map((item) => ({ ...item, amount: item.amount })),
        notes: serviceNotes,
      } : {
        type,
        description: expenseDescription,
        collaborator_user_id: expenseCategory === "Serviços de colaboradores" ? expenseCollaboratorId : "",
        category: expenseCategory,
        amount: expenseAmount,
        expense_date: expenseDate,
        due_date: expenseDueDate,
        expense_type: expenseType,
        classification: expenseClassification,
        property_type: expensePropertyType,
        recurrence_months: expenseType === "fixa_mensal" ? recurrenceMonths : 1,
        payment_status: expenseStatus,
        notes: expenseCategory === "Transporte" && calculatedExpenseFuelCost > 0
          ? [expenseNotes.trim(), describeFuelCost(expenseFuel)].filter(Boolean).join(" · ")
          : expenseNotes,
      };
      const response = await fetch("/api/sistema/financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível salvar o registro.");
      setMessage(result.message ?? "Registro salvo no financeiro.");
      if (type === "service") {
        setCustomerId(""); setServiceName(""); setSource("outros"); setAmountCharged(""); setAmountReceived("0"); setInitialPaymentMethod("pix"); setInitialPaymentDate(localDateValue()); setInstallmentDrafts([{ amount: "", due_date: dateAfterDays(30) }]); setCostItemDrafts([]); setServiceNotes(""); setServiceDate(localDateValue());
      } else {
        setExpenseDescription(""); setExpenseCategory("Materiais e insumos"); setExpenseClassification("despesa_variavel"); setExpensePropertyType("nao_aplica"); setExpenseAmount(""); setExpenseFuel({ distance_km: "", fuel_type: "gasolina", price_per_liter: "", efficiency_km_per_liter: "" }); setExpenseStatus("pago"); setExpenseNotes(""); setExpenseDate(localDateValue()); setExpenseDueDate(localDateValue());
        setExpenseType("avulsa"); setRecurrenceMonths("12"); setExpenseCollaboratorId("");
      }
      await loadData(periodRange.from, periodRange.to);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o registro.");
    } finally {
      if (type === "service") setSavingService(false);
      else setSavingExpense(false);
    }
  }

  function startPayment(service: ServiceRecord, source: "services" | "receivables" = "services") {
    if (paymentSavingRef.current) return;
    const total = Math.max(1, service.installments_total || 1);
    setPaymentServiceId(service.id);
    setPaymentSource(source);
    // Cada baixa exige a escolha explicita; reabrir nao seleciona a proxima parcela.
    setPaymentAmount("");
    setPaymentInstallmentsTotal(String(total));
    setPaymentInstallment("");
    setPaymentMethod("pix");
    setPaymentDate(localDateValue());
    setError("");
    setMessage("");
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>, service: ServiceRecord) {
    event.preventDefault();
    event.stopPropagation();
    if (paymentSavingRef.current) return;
    const selected = getPaymentInstallments(service).find((item) => item.number === Number(paymentInstallment));
    const amount = parseCurrencyInput(paymentAmount);
    if (!selected || selected.balance <= 0 || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) > Math.round(selected.balance * 100)) {
      setError("Selecione uma parcela pendente e informe um valor que não ultrapasse o saldo dela.");
      return;
    }
    const submittedInstallment = selected.number;
    const submittedAmount = paymentAmount;
    paymentSavingRef.current = true;
    setError("");
    setMessage("");
    setSavingPayment(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessão não encontrada. Faça login novamente.");
      const requestPayload = JSON.stringify([service.id, submittedInstallment, Number(paymentInstallmentsTotal), amount, paymentMethod, paymentDate]);
      const requestId = getPaymentRequestId(requestPayload);
      const response = await fetch("/api/sistema/financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          request_id: requestId,
          type: "payment",
          service_record_id: service.id,
          installment_number: submittedInstallment,
          installments_total: Number(paymentInstallmentsTotal),
          payment_method: paymentMethod,
          payment_date: paymentDate,
          amount: submittedAmount,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível registrar o recebimento.");
      completePaymentRequest(requestPayload);
      setMessage(`Recebimento de ${formatCurrency(amount)} registrado somente na ${submittedInstallment}ª parcela. As demais parcelas não foram alteradas.`);
      setPaymentServiceId("");
      setPaymentSource("services");
      setPaymentAmount("");
      setPaymentInstallment("");
      await loadData(periodRange.from, periodRange.to);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Não foi possível registrar o recebimento.");
    } finally {
      paymentSavingRef.current = false;
      setSavingPayment(false);
    }
  }

  function startServiceEdit(service: ServiceRecord) {
    setServiceEditSaved("");
    setEditingServiceId(service.id);
    setServiceEditDraft({
      customer_id: service.customer_id,
      service_name: service.service_name,
      service_date: service.service_date,
      source: service.source,
      amount_charged: formatCurrencyInput(service.amount_charged),
      notes: service.notes ?? "",
      scheduled_installments: (service.scheduled_installments ?? []).map((installment) => ({
        installment_number: installment.installment_number,
        due_date: installment.due_date,
        amount: formatCurrencyInput(installment.amount),
      })),
    });
    setError("");
    setMessage("");
  }

  async function submitServiceEdit(event: FormEvent<HTMLFormElement>, service: ServiceRecord) {
    event.preventDefault();
    if (!serviceEditDraft) return;
    setError("");
    setMessage("");
    setServiceEditSaved("");
    setSavingServiceEdit(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessão não encontrada. Faça login novamente.");
      const response = await fetch("/api/sistema/financeiro", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: "service_record",
          action: "update",
          service_record_id: service.id,
          customer_id: serviceEditDraft.customer_id,
          service_name: serviceEditDraft.service_name,
          service_date: serviceEditDraft.service_date,
          source: serviceEditDraft.source,
          amount_charged: serviceEditDraft.amount_charged,
          notes: serviceEditDraft.notes,
          scheduled_installments: serviceEditDraft.scheduled_installments.map((installment) => ({
            installment_number: installment.installment_number,
            due_date: installment.due_date,
            amount: installment.amount,
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível editar a cobrança.");
      const successMessage = result.message ?? "Cobrança atualizada com sucesso.";
      setServiceEditSaved(successMessage);
      setMessage(successMessage);
      setSavingServiceEdit(false);
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      setEditingServiceId("");
      setServiceEditDraft(null);
      setServiceEditSaved("");
      await loadData(periodRange.from, periodRange.to);
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Não foi possível editar a cobrança.");
    } finally {
      setSavingServiceEdit(false);
    }
  }

  async function deleteServiceRecord(service: ServiceRecord) {
    if (Number(service.amount_received) > 0) {
      setError("Esta cobrança já tem recebimentos registrados e não pode ser excluída.");
      return;
    }
    const confirmed = window.confirm(`Excluir a cobrança “${service.service_name}” de ${service.customers?.name ?? "Cliente"}? O registro sairá do financeiro, mas a operação ficará no histórico.`);
    if (!confirmed) return;
    setError("");
    setMessage("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessão não encontrada. Faça login novamente.");
      const response = await fetch("/api/sistema/financeiro", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: "service_record", action: "delete", service_record_id: service.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível excluir a cobrança.");
      setMessage(result.message ?? "Cobrança excluída do financeiro.");
      await loadData(periodRange.from, periodRange.to);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir a cobrança.");
    }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">Carregando financeiro…</main>;

  const editingService = data.services.find((item) => item.id === editingServiceId) ?? null;

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-[#17002E] px-6 py-5 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <SystemBrand />
          <Link href="/sistema" className="inline-flex items-center gap-2 rounded-lg border border-purple-300 px-4 py-2 text-sm font-medium transition hover:bg-purple-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#17002E]"><span aria-hidden="true">←</span> Voltar ao painel</Link>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm text-slate-500">Gestão do negócio</p><h2 className="mt-2 text-3xl font-bold text-slate-900">Financeiro</h2><p className="mt-2 text-slate-600">Registre serviços, recebimentos e gastos para acompanhar o resultado.</p></div>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="text-sm font-medium text-slate-700">Filtrar por
              <select value={filterMode} onChange={(event) => setFilterMode(event.target.value as typeof filterMode)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900">
                <option value="month">Mês</option><option value="year">Ano</option><option value="day">Dia</option><option value="custom">Período personalizado</option>
              </select>
            </label>
            {filterMode === "month" && <label className="text-sm font-medium text-slate-700">Mês<input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>}
            {filterMode === "year" && <label className="text-sm font-medium text-slate-700">Ano<input type="number" min="2000" max="2100" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} className="mt-1 block w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>}
            {filterMode === "day" && <label className="text-sm font-medium text-slate-700">Dia<input type="date" value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>}
            {filterMode === "custom" && <>
              <label className="text-sm font-medium text-slate-700">De<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
              <label className="text-sm font-medium text-slate-700">Até<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
            </>}
            <button type="button" onClick={applyDateFilter} className="rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-800">Aplicar filtro</button>
            <p className="w-full text-xs text-slate-500">Período aplicado: {formatDate(periodRange.from)} a {formatDate(periodRange.to)}</p>
          </div>
        </div>

        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</p>}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[
            { label: "Faturamento", value: totals.charged, hint: "Serviços realizados no período", style: "border-blue-200 bg-blue-50 text-blue-900" },
            { label: "Recebido", value: totals.received, hint: "Pagamentos que entraram no mês", style: "border-emerald-200 bg-emerald-50 text-emerald-900" },
            { label: "A receber", value: totals.receivable, hint: "Saldo pendente dos serviços", style: "border-amber-200 bg-amber-50 text-amber-900" },
            { label: "Custos e gastos", value: totals.direct + totals.expenses, hint: `${formatCurrency(totals.direct)} em custos diretos`, style: "border-orange-200 bg-orange-50 text-orange-900" },
            { label: "Contas a pagar", value: totals.pendingExpenses, hint: `${totals.pendingExpenseCount} conta(s) pendente(s) no período`, style: "border-amber-200 bg-amber-50 text-amber-900" },
            { label: "Lucro estimado", value: totals.estimatedResult, hint: "Faturamento menos custos e gastos", style: totals.estimatedResult >= 0 ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-900" },
            { label: "Saldo do mês", value: totals.cashBalance, hint: "Recebido menos saídas pagas", style: totals.cashBalance >= 0 ? "border-teal-200 bg-teal-50 text-teal-900" : "border-red-200 bg-red-50 text-red-900" },
          ].map((card) => (
            <article key={card.label} className={`rounded-xl border p-5 shadow-sm ${card.style}`}>
              <p className="text-sm font-medium">{card.label}</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(card.value)}</p>
              <p className="mt-1 text-xs opacity-80">{card.hint}</p>
            </article>
          ))}
        </div>
        <section className="mt-6 rounded-xl border border-violet-200 bg-white p-5 shadow-sm" aria-labelledby="financial-reports-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h3 id="financial-reports-title" className="text-lg font-semibold text-slate-900">Relatórios financeiros</h3><p className="mt-1 text-sm text-slate-600">Gere um arquivo CSV para planilhas ou imprima/salve uma versão em PDF usando o período aplicado. A lista de valores a receber inclui todos os saldos em aberto.</p></div>
            <label className="w-full text-sm font-medium text-slate-700 sm:w-72">Tipo de relatório
              <select value={reportType} onChange={(event) => setReportType(event.target.value as FinancialReportType)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900">
                {Object.entries(financialReportDefinitions).map(([value, definition]) => <option key={value} value={value}>{definition.label}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-expanded={showReportPreview} aria-controls="financial-report-preview" onClick={() => setShowReportPreview((visible) => !visible)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700 focus-visible:ring-offset-2">{showReportPreview ? "Ocultar prévia" : "Visualizar relatório"}</button>
              <button type="button" onClick={downloadFinancialReport} className="rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700 focus-visible:ring-offset-2">Baixar CSV</button>
              <button type="button" onClick={printFinancialReport} className="rounded-lg border border-purple-300 bg-white px-4 py-2.5 text-sm font-semibold text-purple-800 transition hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700 focus-visible:ring-offset-2">Imprimir / salvar PDF</button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">{reportRows.length} registro(s) · {financialReportDefinitions[reportType].label} · {formatDate(periodRange.from)} a {formatDate(periodRange.to)}</p>
          {showReportPreview && <div id="financial-report-preview" className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Prévia do relatório">
            <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 p-5">
              <div className="flex h-20 w-24 flex-none items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white" aria-label="Espaço para a logo do prestador">
                {safeProviderLogoUrl(data.providerProfile?.logo_url) && <>
                  {/* A logo do prestador é um recurso remoto e precisa ser preservada no layout de impressão. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={safeProviderLogoUrl(data.providerProfile?.logo_url)} alt={`Logo de ${data.providerProfile?.display_name || data.organizationName || "prestador"}`} className="h-full w-full object-contain" onError={(event) => event.currentTarget.remove()} />
                </>}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-purple-700">SERVIÇOFÁCIL</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-900">{data.providerProfile?.display_name || data.organizationName || "Prestador"}</h4>
                <p className="mt-1 text-xs leading-5 text-slate-600">{[data.providerProfile?.phone, data.providerProfile?.whatsapp ? `WhatsApp ${data.providerProfile.whatsapp}` : null, data.providerProfile?.email, data.providerProfile?.address].filter((item): item is string => Boolean(item)).join(" · ")}</p>
              </div>
            </header>
            <div className="p-5">
              <h5 className="text-xl font-semibold text-slate-900">{financialReportDefinitions[reportType].label}</h5>
              <p className="mt-1 text-sm text-slate-600">{reportType === "a_receber" ? "Valores em aberto, independentemente da data do serviço" : `Período aplicado: ${formatDate(periodRange.from)} a ${formatDate(periodRange.to)}`}</p>
              {(reportType === "resumo" || reportType === "servicos") && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Resultado direto considera o valor cobrado menos os custos diretos registrados. Despesas gerais não são rateadas por serviço.</p>}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr>{financialReportDefinitions[reportType].headers.map((header) => <th key={header} className="border-b border-slate-200 px-3 py-2.5 font-semibold">{header}</th>)}</tr></thead>
                  <tbody>{reportRows.length ? reportRows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-slate-100">{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="px-3 py-2.5 text-slate-700">{typeof cell === "number" ? formatCurrency(cell) : cell}</td>)}</tr>) : <tr><td colSpan={financialReportDefinitions[reportType].headers.length} className="px-3 py-6 text-center text-slate-500">Nenhum registro encontrado neste relatório.</td></tr>}</tbody>
                </table>
              </div>
              <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500">VALLEX · <a href="mailto:vallexbusiness@gmail.com" className="underline">vallexbusiness@gmail.com</a> · WhatsApp (62) 98540-8497</p>
            </div>
          </div>}
        </section>
        <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-semibold text-amber-950">Contas a pagar</h3><p className="mt-1 text-sm text-amber-900">Vencimentos dentro do período selecionado: {pendingBills.length} conta(s) · {formatCurrency(totals.pendingExpenses)}</p></div>{canManageFinance && <a href="#registrar-conta" className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100">+ Registrar conta</a>}</div>
          {pendingBills.length === 0 ? <p className="mt-4 rounded-lg bg-white/70 p-4 text-sm text-slate-600">Nenhuma conta pendente neste período.</p> : <div className="mt-4 overflow-x-auto rounded-lg bg-white"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="px-3 py-3 font-medium">Vencimento</th><th className="px-3 py-3 font-medium">Conta</th><th className="px-3 py-3 font-medium">Categoria</th><th className="px-3 py-3 font-medium">Classificação</th><th className="px-3 py-3 font-medium">Imóvel</th><th className="px-3 py-3 text-right font-medium">Valor</th>{canManageFinance && <th className="px-3 py-3 text-right font-medium">Ação</th>}</tr></thead><tbody>{pendingBills.map((expense) => <tr key={expense.id} className="border-b border-slate-100"><td className="px-3 py-3 text-slate-700">{formatDate(expense.due_date ?? expense.expense_date)}</td><td className="px-3 py-3 font-medium text-slate-800">{expense.description}{expense.expense_type === "fixa_mensal" && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800">Fixa mensal</span>}</td><td className="px-3 py-3 text-slate-700">{expense.category}</td><td className="px-3 py-3 text-slate-700">{expenseClassificationLabels[expense.classification] ?? "Despesas variáveis"}</td><td className="px-3 py-3 text-slate-700">{propertyTypeLabels[expense.property_type] ?? "Não se aplica"}</td><td className="px-3 py-3 text-right text-slate-700">{formatCurrency(Number(expense.amount))}</td>{canManageFinance && <td className="px-3 py-3 text-right"><button type="button" onClick={() => void updateExpenseStatus(expense, "pago")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">Marcar como paga</button></td>}</tr>)}</tbody></table></div>}
        </section>
        <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50/50 p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-semibold text-blue-950">Fluxo de caixa previsto</h3><p className="mt-1 text-sm text-blue-900">Parcelas de clientes e contas a pagar por vencimento. Inclui contas vencidas e datas do período selecionado.</p></div><span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-800">{formatDate(periodRange.from)} a {formatDate(periodRange.to)}</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm text-emerald-900">Entradas previstas</p><p className="mt-1 text-xl font-bold text-emerald-900">{formatCurrency(cashflowTotals.incoming)}</p></article>
            <article className="rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-900">Saídas previstas</p><p className="mt-1 text-xl font-bold text-amber-900">{formatCurrency(cashflowTotals.outgoing)}</p></article>
            <article className={`rounded-lg border p-4 ${cashflowTotals.incoming - cashflowTotals.outgoing >= 0 ? "border-teal-200 bg-teal-50" : "border-red-200 bg-red-50"}`}><p className="text-sm text-slate-700">Movimento líquido previsto</p><p className={`mt-1 text-xl font-bold ${cashflowTotals.incoming - cashflowTotals.outgoing >= 0 ? "text-teal-900" : "text-red-900"}`}>{formatCurrency(cashflowTotals.incoming - cashflowTotals.outgoing)}</p></article>
          </div>
          {undatedReceivableTotal > 0 && <p className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">{formatCurrency(undatedReceivableTotal)} em saldos de clientes ainda sem vencimento combinado; esse valor não entra no movimento previsto até receber uma data.</p>}
          {cashflowDisplayEntries.length === 0 ? <p className="mt-4 rounded-lg bg-white/80 p-4 text-sm text-slate-600">Não há entradas ou contas a pagar previstas neste período.</p> : <div className="mt-4 overflow-x-auto rounded-lg bg-white"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="px-3 py-3 font-medium">Vencimento</th><th className="px-3 py-3 font-medium">Situação</th><th className="px-3 py-3 font-medium">Cliente / conta</th><th className="px-3 py-3 font-medium">Movimento</th><th className="px-3 py-3 text-right font-medium">Valor previsto</th></tr></thead><tbody>{cashflowDisplayEntries.map((entry) => <tr key={entry.id} className="border-b border-slate-100"><td className="px-3 py-3 text-slate-700">{formatDate(entry.due_date)}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.due_date < localDateValue() ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}`}>{entry.due_date < localDateValue() ? "Vencido" : "Previsto"}</span></td><td className="px-3 py-3 text-slate-700">{entry.customer_name ? <><strong>{entry.customer_name}</strong><span className="block text-xs text-slate-500">{entry.description}</span></> : entry.description}</td><td className="px-3 py-3"><span className={entry.direction === "receber" ? "font-medium text-emerald-800" : "font-medium text-amber-800"}>{entry.direction === "receber" ? "Entrada" : "Saída"}</span></td><td className="px-3 py-3 text-right font-semibold text-slate-800">{formatCurrency(entry.amount)}</td></tr>)}</tbody></table></div>}
          <p className="mt-3 text-xs text-slate-500">Previsão baseada nos vencimentos cadastrados; não representa pagamento confirmado nem saldo bancário.</p>
        </section>
        <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h3 className="text-xl font-semibold text-emerald-950">Valores a receber</h3><p className="mt-1 text-sm text-emerald-900">Pesquise um cliente para localizar serviços com saldo pendente, inclusive parcelas que ainda vão vencer.</p></div>
            <label className="w-full text-sm font-medium text-slate-700 sm:w-80">Buscar cliente ou serviço
              <input type="search" value={receivableSearch} onChange={(event) => setReceivableSearch(event.target.value)} placeholder="Nome do cliente ou serviço" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900" />
            </label>
          </div>
          <p className="mt-4 text-sm font-medium text-emerald-950">{filteredReceivables.length} serviço(s) com saldo · {formatCurrency(filteredReceivables.reduce((sum, service) => sum + Math.max(0, Number(service.amount_charged) - Number(service.amount_received)), 0))} a receber</p>
          {filteredReceivables.length === 0 ? <p className="mt-3 rounded-lg bg-white/80 p-4 text-sm text-slate-600">{receivableSearch ? "Nenhum saldo pendente encontrado para essa busca." : "Não há valores pendentes de clientes."}</p> : <div className="mt-3 overflow-x-auto rounded-lg bg-white"><table className="w-full min-w-[950px] text-left text-sm"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="px-3 py-3 font-medium">Código</th><th className="px-3 py-3 font-medium">Cliente</th><th className="px-3 py-3 font-medium">Serviço</th><th className="px-3 py-3 font-medium">Próximo vencimento</th><th className="px-3 py-3 text-right font-medium">Cobrado</th><th className="px-3 py-3 text-right font-medium">Recebido</th><th className="px-3 py-3 text-right font-medium">Saldo</th><th className="px-3 py-3 text-right font-medium">Ação</th></tr></thead><tbody>{filteredReceivables.map((service) => {
            const nextInstallment = (service.scheduled_installments ?? []).find((installment) => (service.payments ?? []).filter((payment) => payment.installment_number === installment.installment_number).reduce((sum, payment) => sum + Number(payment.amount), 0) < Number(installment.amount));
            const balance = Math.max(0, Number(service.amount_charged) - Number(service.amount_received));
            return <Fragment key={service.id}><tr className="border-b border-slate-100 align-top"><td className="px-3 py-3 font-mono text-xs font-semibold text-purple-800">{service.charge_code}</td><td className="px-3 py-3 font-medium text-slate-800">{service.customers?.name ?? "Cliente"}</td><td className="px-3 py-3 text-slate-700">{service.service_name}</td><td className="px-3 py-3 text-slate-700">{nextInstallment ? formatDate(nextInstallment.due_date) : "Sem vencimento definido"}</td><td className="px-3 py-3 text-right text-slate-700">{formatCurrency(Number(service.amount_charged))}</td><td className="px-3 py-3 text-right text-slate-700">{formatCurrency(Number(service.amount_received))}</td><td className="px-3 py-3 text-right font-semibold text-amber-800">{formatCurrency(balance)}</td><td className="px-3 py-3 text-right">{canManageFinance && <button type="button" onClick={() => paymentServiceId === service.id && paymentSource === "receivables" ? setPaymentServiceId("") : startPayment(service, "receivables")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800">{paymentServiceId === service.id && paymentSource === "receivables" ? "Fechar" : "Registrar recebimento"}</button>}</td></tr>
              {canManageFinance && paymentServiceId === service.id && paymentSource === "receivables" && <tr className="border-b border-slate-100"><td colSpan={8} className="px-3 py-4"><form onSubmit={(event) => void submitPayment(event, service)} className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
                <p className="text-sm font-semibold text-slate-800 sm:col-span-2 lg:col-span-5">Saldo deste serviço: {formatCurrency(balance)}</p>
                <label className="text-xs font-medium text-slate-700">Parcela<select required disabled={savingPayment} value={paymentInstallment} onChange={(event) => { setPaymentInstallment(event.target.value); const selected = getPaymentInstallments(service).find((item) => item.number === Number(event.target.value)); setPaymentAmount(selected && selected.balance > 0 ? formatCurrencyInput(selected.balance) : ""); }} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">Selecione a parcela</option>{getPaymentInstallments(service).map((item) => <option key={item.number} value={item.number} disabled={item.balance <= 0}>{item.number}ª parcela{item.dueDate ? ` · vence ${formatDate(item.dueDate)}` : ""}{item.balance <= 0 ? " · quitada" : ` · saldo ${formatCurrency(item.balance)}`}</option>)}</select></label>
                <label className="text-xs font-medium text-slate-700">Valor recebido (R$)<CurrencyInput required min={0.01} disabled={savingPayment} max={getPaymentInstallments(service).find((item) => item.number === Number(paymentInstallment))?.balance ?? 0} value={paymentAmount} onChange={setPaymentAmount} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" /></label>
                <label className="text-xs font-medium text-slate-700">Meio de pagamento<select required value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm">{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-xs font-medium text-slate-700">Data do recebimento<input required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" /></label>
                <div className="flex items-end"><button disabled={savingPayment || !paymentInstallment} className="w-full rounded-lg bg-purple-700 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50">{savingPayment ? "Salvando…" : paymentInstallment ? `Registrar ${formatCurrency(parseCurrencyInput(paymentAmount) || 0)} na ${paymentInstallment}ª parcela` : "Selecione a parcela"}</button></div>
              </form></td></tr>}
            </Fragment>;
          })}</tbody></table></div>}
        </section>
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-lg font-semibold text-slate-900">Acumulado do negócio</h3><p className="mt-1 text-sm text-slate-600">Considera todos os lançamentos registrados, independentemente do mês selecionado.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Desde o primeiro registro</span></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className={`rounded-lg border p-4 ${Number(data.indicators?.cash_balance ?? 0) >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><p className="text-sm text-slate-600">Saldo acumulado estimado</p><p className={`mt-1 text-2xl font-bold ${Number(data.indicators?.cash_balance ?? 0) >= 0 ? "text-emerald-800" : "text-red-800"}`}>{formatCurrency(Number(data.indicators?.cash_balance ?? 0))}</p><p className="mt-1 text-xs text-slate-500">Recebimentos − custos diretos − gastos pagos</p></article>
            <article className={`rounded-lg border p-4 ${Number(data.indicators?.estimated_profit ?? 0) >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}><p className="text-sm text-slate-600">Lucro estimado acumulado</p><p className={`mt-1 text-2xl font-bold ${Number(data.indicators?.estimated_profit ?? 0) >= 0 ? "text-green-800" : "text-red-800"}`}>{formatCurrency(Number(data.indicators?.estimated_profit ?? 0))}</p><p className="mt-1 text-xs text-slate-500">Faturamento − custos diretos − todos os gastos</p></article>
            <article className="rounded-lg border border-violet-200 bg-violet-50 p-4"><p className="text-sm text-slate-600">Margem de lucro estimada</p><p className="mt-1 text-2xl font-bold text-violet-900">{Number(data.indicators?.profit_margin ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</p><p className="mt-1 text-xs text-slate-500">Parte do faturamento que sobra como lucro estimado</p></article>
          </div>
        </section>
        <p className="mt-3 text-xs leading-5 text-slate-500">São estimativas com base nos lançamentos feitos no painel. O saldo considera custos diretos como saída e apenas gastos gerais marcados como pagos; não inclui impostos, taxas ou movimentações não registradas.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {canManageFinance ? <>
          <form onSubmit={(event) => void submitRecord(event, "service")} className="rounded-xl border border-purple-100 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">Registrar serviço realizado</h3>
            <p className="mt-1 text-sm text-slate-600">Informe o valor cobrado, o plano de parcelas e o que já recebeu.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Cliente
                <select required value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900"><option value="">Selecione um cliente</option>{data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select>
              </label>
              <div className="sm:col-span-2">
                <button type="button" disabled={savingWalkIn || savingService} onClick={() => void handleWalkInCustomer()} className="rounded-lg border border-purple-200 px-3 py-2 text-sm font-semibold text-purple-800 disabled:opacity-50">{savingWalkIn ? "Preparando…" : "Usar cliente avulso"}</button>
                <p className="mt-2 text-xs text-slate-500">Para cobranças pontuais sem identificação. Para acompanhar retornos e dívidas individuais, selecione um cliente cadastrado.</p>
              </div>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Serviço realizado
                <input required minLength={2} maxLength={200} value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="Ex.: consulta previdenciária" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" />
              </label>
              <label className="text-sm font-medium text-slate-700">Data do serviço
                <input required type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" />
              </label>
              <label className="text-sm font-medium text-slate-700">Origem do cliente
                <select value={source} onChange={(event) => setSource(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900">{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <label className="text-sm font-medium text-slate-700">Valor cobrado (R$)
                <CurrencyInput required min={0.01} value={amountCharged} onChange={setAmountCharged} placeholder="0,00" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" />
              </label>
              <label className="text-sm font-medium text-slate-700">Entrada recebida (R$)
                <CurrencyInput required min={0} value={amountReceived} onChange={setAmountReceived} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" />
              </label>
              <label className="text-sm font-medium text-slate-700">Meio de pagamento da entrada
                <select required={parseCurrencyInput(amountReceived) > 0} disabled={parseCurrencyInput(amountReceived) <= 0} value={initialPaymentMethod} onChange={(event) => setInitialPaymentMethod(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 disabled:bg-slate-100 disabled:text-slate-500">
                  {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">Data em que recebeu a entrada
                <input required={parseCurrencyInput(amountReceived) > 0} disabled={parseCurrencyInput(amountReceived) <= 0} type="date" value={initialPaymentDate} onChange={(event) => setInitialPaymentDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 disabled:bg-slate-100 disabled:text-slate-500" />
              </label>
              <div className="sm:col-span-2 rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold text-slate-900">Parcelas a receber</h4><p className="mt-1 text-xs text-slate-600">Informe o valor e o vencimento de cada parcela após a entrada.</p></div><button type="button" disabled={installmentDrafts.length >= 24} onClick={() => setInstallmentDrafts((current) => [...current, { amount: "", due_date: dateAfterDays(30 * (current.length + 1)) }])} className="rounded-lg border border-purple-200 px-3 py-2 text-sm font-medium text-purple-800 hover:bg-purple-50 disabled:opacity-50">Adicionar parcela</button></div>
                <div className="mt-4 space-y-3">{installmentDrafts.map((installment, index) => <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <label className="text-sm font-medium text-slate-700">{index + 1}ª parcela · valor (R$)<CurrencyInput min={0.01} required={installment.due_date !== "" && installment.amount !== ""} value={installment.amount} onChange={(amount) => setInstallmentDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount } : item))} placeholder="0,00" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" /></label>
                  <label className="text-sm font-medium text-slate-700">Data de vencimento<input type="date" required={installment.amount !== ""} value={installment.due_date} onChange={(event) => setInstallmentDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, due_date: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" /></label>
                  {installmentDrafts.length > 1 ? <button type="button" onClick={() => setInstallmentDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg border border-red-200 px-3 py-2.5 text-sm text-red-700 hover:bg-red-50">Remover</button> : <span />}
                </div>)}</div>
                <p className="mt-3 text-sm text-slate-700">Entrada + parcelas planejadas: <strong>{formatCurrency((parseCurrencyInput(amountReceived) || 0) + plannedInstallmentTotal)}</strong> de <strong>{formatCurrency(parseCurrencyInput(amountCharged) || 0)}</strong></p>
                {(parseCurrencyInput(amountReceived) + plannedInstallmentTotal > parseCurrencyInput(amountCharged) && parseCurrencyInput(amountCharged) > 0) && <p role="alert" className="mt-2 text-sm text-red-700">A soma da entrada e das parcelas ultrapassa o valor do serviço.</p>}
                {parseCurrencyInput(amountReceived) + plannedInstallmentTotal < parseCurrencyInput(amountCharged) && parseCurrencyInput(amountCharged) > 0 && <p className="mt-1 text-xs text-slate-500">Saldo ainda sem vencimento: {formatCurrency(parseCurrencyInput(amountCharged) - parseCurrencyInput(amountReceived) - plannedInstallmentTotal)}.</p>}
              </div>
              <div className="sm:col-span-2 rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold text-slate-900">Custos diretos do serviço</h4><p className="mt-1 text-xs text-slate-600">Cadastre cada material, taxa ou outro custo. O total é calculado automaticamente.</p></div><button type="button" disabled={costItemDrafts.length >= 30} onClick={() => setCostItemDrafts((current) => [...current, { category: "materiais_insumos", description: "", amount: "" }])} className="rounded-lg border border-purple-200 px-3 py-2 text-sm font-medium text-purple-800 hover:bg-purple-50 disabled:opacity-50">Adicionar custo</button></div>
                {costItemDrafts.length > 0 && <div className="mt-4 space-y-3">{costItemDrafts.map((item, index) => <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1.4fr_0.8fr_auto] sm:items-end">
                  <label className="text-sm font-medium text-slate-700">Tipo<select value={item.category} onChange={(event) => setCostItemDrafts((current) => current.map((draft, itemIndex) => itemIndex === index ? { ...draft, category: event.target.value } : draft))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900">{Object.entries(costCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="text-sm font-medium text-slate-700">Descrição<input required minLength={2} maxLength={200} value={item.description} onChange={(event) => setCostItemDrafts((current) => current.map((draft, itemIndex) => itemIndex === index ? { ...draft, description: event.target.value } : draft))} placeholder="Ex.: material para instalação da tomada" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" /></label>
                  <label className="text-sm font-medium text-slate-700">Valor (R$)<CurrencyInput required min={0.01} value={item.amount} onChange={(amount) => setCostItemDrafts((current) => current.map((draft, itemIndex) => itemIndex === index ? { ...draft, amount } : draft))} placeholder="0,00" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" /></label>
                  <button type="button" onClick={() => setCostItemDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg border border-red-200 px-3 py-2.5 text-sm text-red-700 hover:bg-red-50">Remover</button>
                </div>)}</div>}
                <p className="mt-3 text-sm text-slate-700">Total do custo direto: <strong>{formatCurrency(serviceDirectCost)}</strong></p>
              </div>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Observação (opcional)
                <textarea maxLength={2000} rows={2} value={serviceNotes} onChange={(event) => setServiceNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" />
              </label>
            </div>
            <button disabled={savingService || !data.customers.length} className="mt-5 rounded-lg bg-purple-700 px-5 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-50">{savingService ? "Salvando…" : "Registrar serviço"}</button>
            {!data.customers.length && <p className="mt-3 text-sm text-amber-700">Selecione um cliente cadastrado ou use o botão Cliente avulso.</p>}
          </form>

          <form id="registrar-conta" onSubmit={(event) => void submitRecord(event, "expense")} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">Registrar gasto ou conta a pagar</h3>
            <p className="mt-1 text-sm text-slate-600">Cadastre despesas avulsas ou programe contas fixas mensais, como aluguel e internet.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">{expenseCategory === "Materiais e insumos" ? "Descrição do material ou insumo" : "Descrição"}
                <input required minLength={2} maxLength={200} value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} placeholder={expenseCategory === "Materiais e insumos" ? "Ex.: fiação, tomadas ou material de limpeza" : "Ex.: conta de energia, aluguel do escritório"} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" />
              </label>
              <label className="text-sm font-medium text-slate-700">Categoria
                <select value={expenseCategory} onChange={(event) => { const nextCategory = event.target.value; setExpenseCategory(nextCategory); if (nextCategory === "Serviços de colaboradores") { setExpenseStatus("pendente"); setExpenseClassification("despesa_variavel"); } else { setExpenseCollaboratorId(""); } setExpenseAmount(nextCategory === "Transporte" ? String(calculateFuelCost(expenseFuel)) : ""); if (!["Aluguel e espaço", "Energia elétrica", "Água", "Internet"].includes(nextCategory)) setExpensePropertyType("nao_aplica"); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900">{expenseCategories.map((category) => <option key={category}>{category}</option>)}</select>
              </label>
              {expenseCategory === "Serviços de colaboradores" && <div className="sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">Colaborador
                  <select required value={expenseCollaboratorId} onChange={(event) => { setExpenseCollaboratorId(event.target.value); setExpenseStatus("pendente"); if (!expenseDescription) setExpenseDescription("Pagamento de serviço"); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
                    <option value="">Selecione um colaborador</option>{collaborators.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
                {collaboratorsWarning && <p role="alert" className="mt-2 text-sm text-amber-800">{collaboratorsWarning}</p>}
                {!collaboratorsWarning && collaborators.length === 0 && <p className="mt-2 text-sm text-slate-500">Nenhum colaborador vinculado. Cadastre a equipe e conclua o aceite do convite.</p>}
                <p className="mt-2 text-xs text-slate-500">Informe o serviço na descrição e o valor combinado. Este lançamento entra nas despesas gerais; não repita um custo já lançado no serviço.</p>
              </div>}
              <label className="text-sm font-medium text-slate-700">Classificar como
                <select value={expenseClassification} onChange={(event) => setExpenseClassification(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900">{Object.entries(expenseClassificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              {["Aluguel e espaço", "Energia elétrica", "Água", "Internet"].includes(expenseCategory) && <label className="text-sm font-medium text-slate-700">Imóvel do negócio
                <select value={expensePropertyType} onChange={(event) => setExpensePropertyType(event.target.value as typeof expensePropertyType)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900"><option value="nao_aplica">Não se aplica</option><option value="alugado">Alugado</option><option value="proprio">Próprio</option></select>
              </label>}
              <label className="text-sm font-medium text-slate-700">Tipo de lançamento
                <select value={expenseType} onChange={(event) => { const nextType = event.target.value as typeof expenseType; setExpenseType(nextType); setExpenseClassification((current) => current === "despesa_fixa" || current === "despesa_variavel" ? nextType === "fixa_mensal" ? "despesa_fixa" : "despesa_variavel" : current); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900"><option value="avulsa">Despesa avulsa</option><option value="fixa_mensal">Conta fixa mensal</option></select>
              </label>
              {expenseType === "fixa_mensal" && <label className="text-sm font-medium text-slate-700">Programar por quantos meses?
                <select value={recurrenceMonths} onChange={(event) => setRecurrenceMonths(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900">{[3, 6, 12, 18, 24].map((months) => <option key={months} value={months}>{months} meses</option>)}</select>
              </label>}
              {expenseCategory === "Transporte" && <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 sm:col-span-2">
                <h4 className="font-semibold text-slate-900">Estimativa de combustível</h4>
                <p className="mt-1 text-xs text-slate-600">Informe a distância total percorrida (ida e volta), o consumo médio do veículo e o preço por litro.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">Distância total (km)<input required type="number" min="0.1" step="0.1" value={expenseFuel.distance_km} onChange={(event) => { const next = { ...expenseFuel, distance_km: event.target.value }; setExpenseFuel(next); setExpenseAmount(String(calculateFuelCost(next))); }} placeholder="Ex.: 24" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900" /></label>
                  <label className="text-sm font-medium text-slate-700">Combustível<select value={expenseFuel.fuel_type} onChange={(event) => { const next = { ...expenseFuel, fuel_type: event.target.value as FuelCostDetails["fuel_type"] }; setExpenseFuel(next); setExpenseAmount(String(calculateFuelCost(next))); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900"><option value="gasolina">Gasolina</option><option value="etanol">Etanol (álcool)</option></select></label>
                  <label className="text-sm font-medium text-slate-700">Preço por litro (R$)<CurrencyInput required min={0.01} value={expenseFuel.price_per_liter} onChange={(price_per_liter) => { const next = { ...expenseFuel, price_per_liter }; setExpenseFuel(next); setExpenseAmount(formatCurrencyInput(calculateFuelCost(next))); }} placeholder="Ex.: 5,89" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900" /></label>
                  <label className="text-sm font-medium text-slate-700">Consumo médio (km/L)<input required type="number" min="0.1" step="0.1" value={expenseFuel.efficiency_km_per_liter} onChange={(event) => { const next = { ...expenseFuel, efficiency_km_per_liter: event.target.value }; setExpenseFuel(next); setExpenseAmount(String(calculateFuelCost(next))); }} placeholder="Ex.: 10,5" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900" /></label>
                </div>
                <p className="mt-3 text-sm text-slate-700">Combustível estimado: <strong>{formatCurrency(calculatedExpenseFuelCost)}</strong></p>
              </div>}
              <label className="text-sm font-medium text-slate-700">Data de vencimento
                <input required type="date" value={expenseDueDate} onChange={(event) => setExpenseDueDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" />
              </label>
              <label className="text-sm font-medium text-slate-700">Valor (R$)
                <CurrencyInput required min={0.01} readOnly={expenseCategory === "Transporte"} value={expenseAmount} onChange={setExpenseAmount} placeholder="0,00" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 read-only:bg-slate-100" />
              </label>
              <label className="text-sm font-medium text-slate-700">Situação
                <select value={expenseStatus} onChange={(event) => setExpenseStatus(event.target.value as "pago" | "pendente")} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900"><option value="pago">Pago</option><option value="pendente">Pendente</option></select>
              </label>
              {expenseStatus === "pago" && <label className="text-sm font-medium text-slate-700">Data do pagamento
                <input required type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" />
              </label>}
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Observação (opcional)
                <textarea maxLength={2000} rows={2} value={expenseNotes} onChange={(event) => setExpenseNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900" />
              </label>
            </div>
            <button disabled={savingExpense} className="mt-5 rounded-lg bg-purple-700 px-5 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-50">{savingExpense ? "Salvando…" : expenseType === "fixa_mensal" ? "Programar conta fixa" : "Registrar gasto/conta"}</button>
          </form>
          </> : <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 lg:col-span-2">Acesso somente para consulta. O proprietário ainda não liberou alterações no Financeiro.</p>}
        </div>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-semibold text-slate-900">Serviços do período</h3><p className="mt-1 text-sm text-slate-600">{data.services.length} registros · a receber destes serviços {formatCurrency(totals.receivable)}</p></div><div className="text-sm sm:text-right"><p className="text-slate-600">Custos diretos: {formatCurrency(totals.direct)}</p><p className={`mt-1 font-semibold ${(totals.charged - totals.direct) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>Resultado direto: {formatCurrency(totals.charged - totals.direct)} · margem {totals.charged > 0 ? (((totals.charged - totals.direct) / totals.charged) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "0"}%</p></div></div>
          <p className="mt-2 text-xs text-slate-500">Resultado direto = valor cobrado menos custos diretos registrados. Despesas gerais do negócio não são rateadas por serviço.</p>
          {data.services.length === 0 ? <p className="mt-5 rounded-lg bg-slate-50 p-6 text-center text-slate-600">Nenhum serviço registrado neste período.</p> : <>
          <h4 className="mt-5 text-lg font-semibold text-slate-900">Serviços em aberto <span className="text-sm font-normal text-slate-500">({data.services.filter((service) => Number(service.amount_received) < Number(service.amount_charged)).length})</span></h4>
          {data.services.filter((service) => Number(service.amount_received) < Number(service.amount_charged)).length === 0 ? <p className="mt-3 rounded-lg bg-slate-50 p-5 text-sm text-slate-600">Nenhuma cobrança em aberto neste período.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[1320px] text-left text-sm"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="px-3 py-3 font-medium">Código</th><th className="px-3 py-3 font-medium">Data</th><th className="px-3 py-3 font-medium">Cliente</th><th className="px-3 py-3 font-medium">Serviço</th><th className="px-3 py-3 font-medium">Origem</th><th className="px-3 py-3 text-right font-medium">Cobrado</th><th className="px-3 py-3 text-right font-medium">Recebido total</th><th className="px-3 py-3 text-right font-medium">Custo direto</th><th className="px-3 py-3 text-right font-medium">Resultado direto</th><th className="px-3 py-3 text-right font-medium">Margem</th><th className="px-3 py-3 font-medium">Plano</th><th className="px-3 py-3 text-right font-medium">Ações</th></tr></thead><tbody>{data.services.filter((service) => Number(service.amount_received) < Number(service.amount_charged)).map((service) => {
            const serviceResult = Number(service.amount_charged) - Number(service.direct_cost);
            const serviceMargin = Number(service.amount_charged) > 0 ? (serviceResult / Number(service.amount_charged)) * 100 : 0;
            return <Fragment key={service.id}>
            <tr className="border-b border-slate-100 align-top">
              <td className="px-3 py-3 font-mono text-xs font-semibold text-purple-800">{service.charge_code}</td>
              <td className="px-3 py-3 text-slate-700">{formatDate(service.service_date)}</td>
              <td className="px-3 py-3 text-slate-700">{service.customers?.name ?? "Cliente"}</td>
              <td className="px-3 py-3 text-slate-700">{service.service_name}<ServiceInstallments service={service} /></td>
              <td className="px-3 py-3 text-slate-700">{sourceLabels[service.source] ?? "Outro"}</td>
              <td className="px-3 py-3 text-right text-slate-700">{formatCurrency(Number(service.amount_charged))}</td>
              <td className="px-3 py-3 text-right text-slate-700">{formatCurrency(Number(service.amount_received))}</td>
              <td className="px-3 py-3 text-right text-slate-700">{formatCurrency(Number(service.direct_cost))}{service.cost_items?.length > 0 && <div className="mt-1 space-y-1 text-left text-xs text-slate-500">{service.cost_items.map((item) => <p key={item.id}>{costCategoryLabels[item.category] ?? "Outro"}: {item.description} · {formatCurrency(Number(item.amount))}</p>)}</div>}</td>
              <td className={`px-3 py-3 text-right font-semibold ${serviceResult >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatCurrency(serviceResult)}</td>
              <td className={`px-3 py-3 text-right font-medium ${serviceMargin >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{serviceMargin.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</td>
              <td className="px-3 py-3 text-slate-700">{service.scheduled_installments?.length ? `${service.scheduled_installments.length} parcela(s)` : "À vista"}</td>
              <td className="px-3 py-3 text-right">{canManageFinance && <div className="flex min-w-28 flex-col items-end gap-2">
                <button type="button" onClick={() => editingServiceId === service.id ? (setEditingServiceId(""), setServiceEditDraft(null)) : startServiceEdit(service)} className="rounded-lg border border-purple-200 px-3 py-2 text-xs font-medium text-purple-800 hover:bg-purple-50">{editingServiceId === service.id ? "Fechar edição" : "Editar"}</button>
                <button type="button" disabled={Number(service.amount_received) > 0} title={Number(service.amount_received) > 0 ? "Uma cobrança com recebimentos não pode ser excluída." : "Excluir cobrança"} onClick={() => void deleteServiceRecord(service)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45">Excluir</button>
                {Number(service.amount_received) < Number(service.amount_charged) && <button type="button" onClick={() => paymentServiceId === service.id && paymentSource === "services" ? setPaymentServiceId("") : startPayment(service)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50">{paymentServiceId === service.id && paymentSource === "services" ? "Fechar baixa" : "Registrar recebimento"}</button>}
              </div>}</td>
            </tr>
            {canManageFinance && paymentServiceId === service.id && paymentSource === "services" && <tr key={`${service.id}-payment`} className="border-b border-slate-100"><td colSpan={12} className="px-3 py-4"><form onSubmit={(event) => void submitPayment(event, service)} className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
              <p className="text-sm font-semibold text-slate-800 sm:col-span-2 lg:col-span-5">Saldo deste serviço: {formatCurrency(Math.max(0, Number(service.amount_charged) - Number(service.amount_received)))}</p>
              <label className="text-xs font-medium text-slate-700">Parcela<select required disabled={savingPayment} value={paymentInstallment} onChange={(event) => { setPaymentInstallment(event.target.value); const selected = getPaymentInstallments(service).find((item) => item.number === Number(event.target.value)); setPaymentAmount(selected && selected.balance > 0 ? formatCurrencyInput(selected.balance) : ""); }} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">Selecione a parcela</option>{getPaymentInstallments(service).map((item) => <option key={item.number} value={item.number} disabled={item.balance <= 0}>{item.number}ª parcela{item.dueDate ? ` · vence ${formatDate(item.dueDate)}` : ""}{item.balance <= 0 ? " · quitada" : ` · saldo ${formatCurrency(item.balance)}`}</option>)}</select></label>
              <label className="text-xs font-medium text-slate-700">Valor recebido (R$)<CurrencyInput required min={0.01} disabled={savingPayment} max={getPaymentInstallments(service).find((item) => item.number === Number(paymentInstallment))?.balance ?? 0} value={paymentAmount} onChange={setPaymentAmount} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-slate-700">Meio de pagamento<select required value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm">{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-xs font-medium text-slate-700">Data do recebimento<input required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" /></label>
              <div className="flex items-end"><button disabled={savingPayment || !paymentInstallment} className="w-full rounded-lg bg-purple-700 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50">{savingPayment ? "Salvando…" : paymentInstallment ? `Registrar ${formatCurrency(parseCurrencyInput(paymentAmount) || 0)} na ${paymentInstallment}ª parcela` : "Selecione a parcela"}</button></div>
            </form></td></tr>}
            </Fragment>;
          })}</tbody></table></div>}
          <h4 className="mt-8 text-lg font-semibold text-slate-900">Serviços quitados <span className="text-sm font-normal text-slate-500">({data.services.filter((service) => Number(service.amount_received) >= Number(service.amount_charged)).length})</span></h4>
          {data.services.filter((service) => Number(service.amount_received) >= Number(service.amount_charged)).length === 0 ? <p className="mt-3 rounded-lg bg-slate-50 p-5 text-sm text-slate-600">Nenhum serviço quitado neste período.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="px-3 py-3 font-medium">Código</th><th className="px-3 py-3 font-medium">Data</th><th className="px-3 py-3 font-medium">Cliente</th><th className="px-3 py-3 font-medium">Serviço</th><th className="px-3 py-3 text-right font-medium">Cobrado</th><th className="px-3 py-3 text-right font-medium">Recebido</th></tr></thead><tbody>{data.services.filter((service) => Number(service.amount_received) >= Number(service.amount_charged)).map((service) => <tr key={service.id} className="border-b border-slate-100"><td className="px-3 py-3 font-mono text-xs font-semibold text-purple-800">{service.charge_code}</td><td className="px-3 py-3">{formatDate(service.service_date)}</td><td className="px-3 py-3">{service.customers?.name ?? "Cliente"}</td><td className="px-3 py-3">{service.service_name}</td><td className="px-3 py-3 text-right">{formatCurrency(Number(service.amount_charged))}</td><td className="px-3 py-3 text-right">{formatCurrency(Number(service.amount_received))}</td></tr>)}</tbody></table></div>}
          </>}
        </section>
        {canManageFinance && editingService && serviceEditDraft && createPortal(<div style={{ position: "fixed", inset: 0, zIndex: 1000 }} className="flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setEditingServiceId(""); setServiceEditDraft(null); setServiceEditSaved(""); } }}><section role="dialog" aria-modal="true" aria-labelledby="service-edit-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7"><div className="mb-5 flex items-start justify-between gap-4"><div><h3 id="service-edit-title" className="text-xl font-semibold text-slate-900">Editar cobrança</h3><p className="mt-1 text-sm text-slate-600">Código {editingService.charge_code}</p></div><button type="button" aria-label="Fechar edição" onClick={() => { setEditingServiceId(""); setServiceEditDraft(null); setServiceEditSaved(""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50">✕</button></div><form onSubmit={(event) => void submitServiceEdit(event, editingService)} className="space-y-4">
              {serviceEditSaved && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">✓ {serviceEditSaved} A janela será fechada em instantes.</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs font-medium text-slate-700">Cliente<select required value={serviceEditDraft.customer_id} onChange={(event) => setServiceEditDraft((draft) => draft ? { ...draft, customer_id: event.target.value } : draft)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm">{!data.customers.some((customer) => customer.id === serviceEditDraft.customer_id) && <option value={serviceEditDraft.customer_id}>{editingService.customers?.name ?? "Cliente atual"}</option>}{data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                <label className="text-xs font-medium text-slate-700">Serviço / cobrança<input required minLength={2} maxLength={200} value={serviceEditDraft.service_name} onChange={(event) => setServiceEditDraft((draft) => draft ? { ...draft, service_name: event.target.value } : draft)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" /></label>
                <label className="text-xs font-medium text-slate-700">Data do serviço<input required type="date" value={serviceEditDraft.service_date} onChange={(event) => setServiceEditDraft((draft) => draft ? { ...draft, service_date: event.target.value } : draft)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" /></label>
                <label className="text-xs font-medium text-slate-700">Origem<select required value={serviceEditDraft.source} onChange={(event) => setServiceEditDraft((draft) => draft ? { ...draft, source: event.target.value } : draft)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm">{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-xs font-medium text-slate-700">Valor cobrado (R$)<CurrencyInput required min={Number(editingService.amount_received)} value={serviceEditDraft.amount_charged} onChange={(amount_charged) => setServiceEditDraft((draft) => draft ? { ...draft, amount_charged } : draft)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" /></label>
                <label className="text-xs font-medium text-slate-700 sm:col-span-2 lg:col-span-3">Observação<textarea maxLength={2000} rows={2} value={serviceEditDraft.notes} onChange={(event) => setServiceEditDraft((draft) => draft ? { ...draft, notes: event.target.value } : draft)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" /></label>
              </div>
              {serviceEditDraft.scheduled_installments.length > 0 && <div><p className="mb-2 text-sm font-semibold text-slate-800">Parcelas e vencimentos</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{serviceEditDraft.scheduled_installments.map((installment) => <div key={installment.installment_number} className="grid grid-cols-2 gap-2 rounded border border-purple-100 bg-white p-3"><p className="col-span-2 text-xs font-semibold text-slate-700">{installment.installment_number}ª parcela</p><label className="text-xs text-slate-600">Vencimento<input required type="date" value={installment.due_date} onChange={(event) => setServiceEditDraft((draft) => draft ? { ...draft, scheduled_installments: draft.scheduled_installments.map((item) => item.installment_number === installment.installment_number ? { ...item, due_date: event.target.value } : item) } : draft)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" /></label><label className="text-xs text-slate-600">Valor (R$)<CurrencyInput required min={0.01} value={installment.amount} onChange={(amount) => setServiceEditDraft((draft) => draft ? { ...draft, scheduled_installments: draft.scheduled_installments.map((item) => item.installment_number === installment.installment_number ? { ...item, amount } : item) } : draft)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" /></label></div>)}</div><p className="mt-2 text-xs text-slate-600">A quantidade de parcelas não pode mudar por esta tela. Valores já recebidos em cada parcela precisam ser mantidos.</p></div>}
              <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => { setEditingServiceId(""); setServiceEditDraft(null); setServiceEditSaved(""); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button><button disabled={savingServiceEdit || Boolean(serviceEditSaved)} className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50">{savingServiceEdit ? "Salvando…" : serviceEditSaved ? "Salvo" : "Salvar alterações"}</button></div>
            </form></section></div>, document.body)}

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">Recebimentos no período</h3>
          <p className="mt-1 text-sm text-slate-600">{data.payments.length} parcelas · total {formatCurrency(totals.received)}</p>
          {data.payments.length === 0 ? <p className="mt-5 rounded-lg bg-slate-50 p-6 text-center text-slate-600">Nenhum recebimento neste período.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="px-3 py-3 font-medium">Data</th><th className="px-3 py-3 font-medium">Cliente</th><th className="px-3 py-3 font-medium">Serviço</th><th className="px-3 py-3 font-medium">Parcela</th><th className="px-3 py-3 font-medium">Meio</th><th className="px-3 py-3 text-right font-medium">Valor</th></tr></thead><tbody>{data.payments.map((payment) => <tr key={payment.id} className="border-b border-slate-100"><td className="px-3 py-3 text-slate-700">{formatDate(payment.payment_date)}</td><td className="px-3 py-3 text-slate-700">{payment.organization_service_records?.customers?.name ?? "Cliente"}</td><td className="px-3 py-3 text-slate-700">{payment.organization_service_records?.service_name ?? "Serviço"}</td><td className="px-3 py-3 text-slate-700">{payment.installment_number === 0 ? "Entrada" : `${payment.installment_number}ª parcela`}</td><td className="px-3 py-3 text-slate-700">{paymentMethodLabels[payment.payment_method] ?? "Outro"}</td><td className="px-3 py-3 text-right text-slate-700">{formatCurrency(Number(payment.amount))}</td></tr>)}</tbody></table></div>}
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-semibold text-slate-900">Gastos pagos do período</h3><p className="mt-1 text-sm text-slate-600">{paidExpensesInPeriod.length} lançamentos · total {formatCurrency(totals.paidExpenses)}</p></div></div>
          {paidExpensesInPeriod.length === 0 ? <p className="mt-5 rounded-lg bg-slate-50 p-6 text-center text-slate-600">Nenhum gasto pago neste período.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="px-3 py-3 font-medium">Data do pagamento</th><th className="px-3 py-3 font-medium">Descrição</th><th className="px-3 py-3 font-medium">Tipo</th><th className="px-3 py-3 font-medium">Categoria</th><th className="px-3 py-3 font-medium">Classificação</th><th className="px-3 py-3 font-medium">Imóvel</th><th className="px-3 py-3 text-right font-medium">Valor</th>{canManageFinance && <th className="px-3 py-3 text-right font-medium">Ação</th>}</tr></thead><tbody>{paidExpensesInPeriod.map((expense) => <tr key={expense.id} className="border-b border-slate-100"><td className="px-3 py-3 text-slate-700">{formatDate(expense.expense_date)}</td><td className="px-3 py-3 text-slate-700">{expense.description}</td><td className="px-3 py-3 text-slate-700">{expense.expense_type === "fixa_mensal" ? "Conta fixa" : "Avulsa"}</td><td className="px-3 py-3 text-slate-700">{expense.category}</td><td className="px-3 py-3 text-slate-700">{expenseClassificationLabels[expense.classification] ?? "Despesas variáveis"}</td><td className="px-3 py-3 text-slate-700">{propertyTypeLabels[expense.property_type] ?? "Não se aplica"}</td><td className="px-3 py-3 text-right text-slate-700">{formatCurrency(Number(expense.amount))}</td>{canManageFinance && <td className="px-3 py-3 text-right"><button type="button" onClick={() => void updateExpenseStatus(expense, "pendente")} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-50">Voltar a pendente</button></td>}</tr>)}</tbody></table></div>}
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="finance-audit-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h3 id="finance-audit-title" className="text-xl font-semibold text-slate-900">Histórico de operações</h3><p className="mt-1 text-sm text-slate-600">{filteredAuditEvents.length} operação(ões) entre {formatDate(periodRange.from)} e {formatDate(periodRange.to)}. Altere o período nos filtros do Financeiro.</p></div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-medium text-slate-700">Operação<select value={auditAction} onChange={(event) => setAuditAction(event.target.value as "all" | AuditAction)} className="mt-1 block min-w-52 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="all">Todas as operações</option>{Object.entries(auditActionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <button type="button" onClick={downloadAuditReport} disabled={!filteredAuditEvents.length} className="rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50">Gerar relatório CSV</button>
            </div>
          </div>
          {auditError ? <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{auditError}</p> : filteredAuditEvents.length === 0 ? <p className="mt-5 rounded-lg bg-slate-50 p-6 text-center text-slate-600">Nenhuma operação encontrada neste período e filtro.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="px-3 py-3 font-medium">Data e hora</th><th className="px-3 py-3 font-medium">Operação</th><th className="px-3 py-3 font-medium">Cliente</th><th className="px-3 py-3 font-medium">Cobrança</th><th className="px-3 py-3 font-medium">Usuário</th><th className="px-3 py-3 font-medium">Detalhes</th></tr></thead><tbody>{filteredAuditEvents.map((event) => <tr key={event.id} className="border-b border-slate-100 align-top"><td className="px-3 py-3 text-slate-700">{new Date(event.created_at).toLocaleString("pt-BR")}</td><td className="px-3 py-3 font-medium text-slate-800">{auditActionLabels[event.action]}</td><td className="px-3 py-3 text-slate-700">{auditEventCustomer(event)}</td><td className="px-3 py-3 text-slate-700">{auditEventService(event)}</td><td className="px-3 py-3 text-xs text-slate-600" title={event.actor_user_id ?? "Usuário não identificado"}>{event.actor_email ?? (event.actor_user_id ? event.actor_user_id.slice(0, 8) : "—")}</td><td className="max-w-lg px-3 py-3 text-slate-600">{auditEventSummary(event)}</td></tr>)}</tbody></table></div>}
        </section>
      </section>
    </main>
  );
}
