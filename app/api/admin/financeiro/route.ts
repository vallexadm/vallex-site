import { NextResponse } from "next/server";
import { requirePlatformPermission } from "@/lib/server/platform-admin";

export const runtime = "nodejs";

const entryTypes = ["income", "expense"] as const;
const statuses = ["paid", "pending", "canceled"] as const;
const paymentMethods = ["pix", "transferencia", "cartao", "dinheiro", "boleto", "outro"] as const;
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
function isCredit(type = "") {
  const value = type.toUpperCase();
  return value === "CREDIT" || value.includes("CREDIT") || value.includes("RECEIVED") || value.includes("REVERSAL") || value.includes("REFUND_CANCELLATION") || value.includes("CASHBACK");
}

function parseAmount(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const normalized = value.trim().replace(/\s|R\$/gi, "");
  return normalized.includes(",") ? Number(normalized.replace(/\./g, "").replace(",", ".")) : Number(normalized);
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function readEntry(body: Record<string, unknown>) {
  const entryType = text(body.entry_type, 20);
  const category = text(body.category, 80);
  const description = text(body.description, 180);
  const amount = parseAmount(body.amount);
  const entryDate = text(body.entry_date, 10);
  const dueDate = text(body.due_date, 10);
  const status = text(body.status, 20);
  const paymentMethod = text(body.payment_method, 30);
  if (!entryTypes.includes(entryType as (typeof entryTypes)[number])) throw new Error("Selecione receita ou despesa.");
  if (!category) throw new Error("Informe a categoria da movimentação.");
  if (description.length < 2) throw new Error("Informe a descrição da movimentação.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Informe um valor válido maior que zero.");
  if (!validDate(entryDate)) throw new Error("Informe uma data válida.");
  if (dueDate && !validDate(dueDate)) throw new Error("Informe um vencimento válido.");
  if (!statuses.includes(status as (typeof statuses)[number])) throw new Error("Selecione uma situação válida.");
  if (!paymentMethods.includes(paymentMethod as (typeof paymentMethods)[number])) throw new Error("Selecione uma forma de pagamento válida.");
  const salesClientId = text(body.sales_client_id, 50);
  if (salesClientId && !/^[0-9a-f-]{36}$/i.test(salesClientId)) throw new Error("Selecione um cadastro de vendas válido.");
  return {
    entry_type: entryType,
    category,
    description,
    amount,
    entry_date: entryDate,
    due_date: dueDate || null,
    status,
    payment_method: paymentMethod,
    sales_client_id: salesClientId || null,
    notes: text(body.notes, 2000) || null,
  };
}

function monthStart() {
  return new Date().toISOString().slice(0, 8) + "01";
}

async function fetchAsaas(from: string, to: string) {
  const baseUrl = process.env.ASAAS_API_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!baseUrl || !apiKey) return { configured: false, balance: null, transactions: [], message: "Configure ASAAS_API_URL e ASAAS_API_KEY para consultar saldo e extrato." };
  try {
    const headers = { access_token: apiKey, Accept: "application/json", "User-Agent": "VALLEX-ServicoFacil/1.0.0" };
    const [balanceResponse, firstPage] = await Promise.all([
      fetch(`${baseUrl}/finance/balance`, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) }),
      fetch(`${baseUrl}/financialTransactions?startDate=${encodeURIComponent(from)}&finishDate=${encodeURIComponent(to)}&limit=100&offset=0`, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) }),
    ]);
    if (!balanceResponse.ok || !firstPage.ok) throw new Error("ASAAS_REQUEST_FAILED");
    const balanceJson = await balanceResponse.json() as { balance?: number };
    const pageJson = await firstPage.json() as { data?: AsaasTransaction[]; hasMore?: boolean };
    const transactions = [...(pageJson.data ?? [])];
    let offset = transactions.length;
    let hasMore = pageJson.hasMore === true;
    while (hasMore && offset < 1000) {
      const pageResponse = await fetch(`${baseUrl}/financialTransactions?startDate=${encodeURIComponent(from)}&finishDate=${encodeURIComponent(to)}&limit=100&offset=${offset}`, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) });
      if (!pageResponse.ok) break;
      const page = await pageResponse.json() as { data?: AsaasTransaction[]; hasMore?: boolean };
      const rows = page.data ?? [];
      transactions.push(...rows);
      hasMore = page.hasMore === true;
      if (!rows.length) break;
      offset += rows.length;
    }
    return { configured: true, balance: typeof balanceJson.balance === "number" ? balanceJson.balance : null, transactions, message: "" };
  } catch {
    return { configured: true, balance: null, transactions: [], message: "Não foi possível consultar o Asaas. Verifique a chave, o ambiente e tente atualizar." };
  }
}

type AsaasTransaction = {
  id?: string;
  value?: number;
  balance?: number;
  type?: string;
  date?: string;
  description?: string;
  paymentId?: string;
  transferId?: string;
  billId?: string;
};

export async function GET(request: Request) {
  const auth = await requirePlatformPermission(request, "finance", "view");
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? monthStart();
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  if (!validDate(from) || !validDate(to) || from > to) return NextResponse.json({ ok: false, message: "Selecione um período válido." }, { status: 400 });

  const asaas = await fetchAsaas(from, to);
  const bankRows = asaas.transactions.filter((row) => row.id && Number.isFinite(Number(row.value)) && row.date);
  if (bankRows.length) {
    const bankEntries = bankRows.map((row) => {
      const credit = isCredit(row.type);
      const originalDescription = text(row.description, 180) || `Movimentação Asaas ${row.type ?? ""}`.trim();
      const searchable = `${row.type ?? ""} ${originalDescription}`.toLocaleLowerCase("pt-BR");
      let category = credit ? "Receita Asaas" : "Despesa via Asaas";
      if (!credit && (searchable.includes("transfer") || searchable.includes("sangria"))) category = "Sangria e retirada";
      else if (!credit && (searchable.includes("fee") || searchable.includes("tarifa"))) category = "Impostos e tarifas";
      else if (!credit && (searchable.includes("internet") || searchable.includes("telefon"))) category = "Internet e telefonia";
      else if (!credit && (searchable.includes("chatgpt") || searchable.includes("openai") || searchable.includes("artificial intelligence"))) category = "Software e inteligência artificial";
      return {
        entry_type: credit ? "income" : "expense",
        category,
        description: originalDescription,
        amount: Math.abs(Number(row.value)),
        entry_date: String(row.date).slice(0, 10),
        due_date: null,
        status: "paid",
        payment_method: "asaas",
        source: "asaas",
        asaas_transaction_id: row.id,
        source_description: originalDescription,
        asaas_type: text(row.type, 100) || null,
      };
    });
    const { error: syncError } = await auth.context.supabase.from("vallex_finance_entries").upsert(bankEntries, { onConflict: "asaas_transaction_id", ignoreDuplicates: true });
    if (syncError) console.error("Falha ao registrar extrato Asaas no livro financeiro VALLEX:", syncError);
  }
  const [entriesResult, salesResult] = await Promise.all([
    auth.context.supabase.from("vallex_finance_entries").select("*").is("deleted_at", null).gte("entry_date", from).lte("entry_date", to).order("entry_date", { ascending: false }).limit(1500),
    auth.context.supabase.from("vallex_sales_clients").select("id,contact_name,company_name,product,product_scope,stage,contract_start_date,contract_end_date,setup_value,monthly_value,archived_at").order("updated_at", { ascending: false }).limit(2000),
  ]);
  if (entriesResult.error) return NextResponse.json({ ok: false, code: "FINANCE_SCHEMA_REQUIRED", message: "A estrutura do Financeiro VALLEX ainda não foi aplicada. Execute supabase/financeiro_vallex.sql no Supabase de teste." }, { status: 503 });
  const sales = salesResult.error ? [] : (salesResult.data ?? []).filter((sale) => !sale.archived_at);
  return NextResponse.json({
    ok: true,
    permissions: auth.context.permissions,
    entries: entriesResult.data ?? [],
    sales,
    asaas: { configured: asaas.configured, balance: asaas.balance, transactions: asaas.transactions, message: asaas.message },
    asaasSalesAvailable: !salesResult.error,
    period: { from, to },
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requirePlatformPermission(request, "finance", "edit");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const entry = readEntry(body);
    const { data, error } = await auth.context.supabase.from("vallex_finance_entries").insert({ ...entry, created_by: auth.context.userId, updated_by: auth.context.userId }).select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar a movimentação.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const body = await request.clone().json().catch(() => ({})) as Record<string, unknown>;
  const auth = await requirePlatformPermission(request, "finance", body.deleted === true ? "delete" : "edit");
  if (!auth.ok) return auth.response;
  const id = text(body.id, 50);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, message: "Movimentação inválida." }, { status: 400 });
  const { data: current, error: currentError } = await auth.context.supabase.from("vallex_finance_entries").select("source").eq("id", id).is("deleted_at", null).maybeSingle();
  if (currentError || !current) return NextResponse.json({ ok: false, message: "Movimentação não encontrada." }, { status: 404 });
  if (body.deleted === true) {
    if (current.source === "asaas") return NextResponse.json({ ok: false, message: "Movimentações importadas do Asaas não podem ser excluídas. Elas fazem parte do extrato bancário." }, { status: 400 });
    const { error } = await auth.context.supabase.from("vallex_finance_entries").update({ deleted_at: new Date().toISOString(), updated_by: auth.context.userId, updated_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null);
    if (error) return NextResponse.json({ ok: false, message: "Não foi possível excluir a movimentação." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  let update: Record<string, unknown>;
  if (current.source === "asaas") {
    const category = text(body.category, 80);
    const description = text(body.description, 180);
    if (!category || description.length < 2) return NextResponse.json({ ok: false, message: "Informe uma categoria e descrição válidas." }, { status: 400 });
    update = { category, description, updated_by: auth.context.userId, updated_at: new Date().toISOString() };
  } else {
    if (typeof body.entry_type === "string") {
      update = { ...readEntry(body), updated_by: auth.context.userId, updated_at: new Date().toISOString() };
    } else {
      const status = text(body.status, 20);
      if (!statuses.includes(status as (typeof statuses)[number])) return NextResponse.json({ ok: false, message: "Situação inválida." }, { status: 400 });
      update = { status, updated_by: auth.context.userId, updated_at: new Date().toISOString() };
    }
  }
  const { error } = await auth.context.supabase.from("vallex_finance_entries").update(update).eq("id", id).is("deleted_at", null);
  if (error) return NextResponse.json({ ok: false, message: "Não foi possível atualizar a movimentação." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
