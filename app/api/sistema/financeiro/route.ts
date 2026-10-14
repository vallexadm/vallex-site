import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const sources = ["vallex", "indicacao", "redes_sociais", "busca_web", "recorrente", "outros"] as const;
const paymentStatuses = ["pago", "pendente"] as const;
const paymentMethods = ["pix", "transferencia", "dinheiro", "cartao_credito", "cartao_debito", "boleto", "outro"] as const;
const costCategories = ["materiais_insumos", "taxas_cartorio", "transporte", "ferramentas_equipamentos", "terceirizados", "alimentacao_hospedagem", "outros"] as const;

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function monthlyDueDate(startDate: string, monthOffset: number) {
  const [year, month, day] = startDate.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
  const lastDay = new Date(Date.UTC(firstOfMonth.getUTCFullYear(), firstOfMonth.getUTCMonth() + 1, 0)).getUTCDate();
  return `${firstOfMonth.getUTCFullYear()}-${String(firstOfMonth.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

async function getOwnerContext(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const authAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseSecretKey || !authUrl || !authAnonKey) {
    return { error: fail("Configuração do servidor incompleta.", 500) };
  }

  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return { error: fail("Autenticação necessária.", 401) };

  const authClient = createClient(authUrl, authAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !user) return { error: fail("Sessão inválida ou expirada.", 401) };

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (organizationError) {
    console.error("Erro ao consultar organização no financeiro:", organizationError);
    return { error: fail("Não foi possível consultar a organização.", 500) };
  }
  if (!organization) return { error: fail("O financeiro está disponível somente para o proprietário.", 403) };
  return { admin, user, organization };
}

export async function GET(request: Request) {
  try {
    const context = await getOwnerContext(request);
    if ("error" in context) return context.error;
    const { admin, organization } = context;
    const params = new URL(request.url).searchParams;
    if (params.get("receivables") === "all") {
      const { data: outstandingServices, error } = await admin.from("organization_service_records")
        .select("id, customer_id, service_name, service_date, source, amount_charged, amount_received, direct_cost, installments_total, notes, created_at, customers(id, name), payments:organization_service_payments(id, installment_number, payment_method, payment_date, amount), scheduled_installments:organization_service_installments(id, installment_number, due_date, amount), cost_items:organization_service_cost_items(id, category, description, amount)")
        .eq("organization_id", organization.id)
        .order("service_date", { ascending: false })
        .limit(5000);
      if (error) {
        console.error("Erro ao consultar valores a receber:", error);
        return fail("Não foi possível carregar os valores a receber.", 500);
      }
      const receivables = (outstandingServices ?? []).filter((service) => Number(service.amount_charged) > Number(service.amount_received));
      return NextResponse.json({ ok: true, receivables });
    }
    if (params.get("cashflow") === "all") {
      const [servicesResult, expensesResult] = await Promise.all([
        admin.from("organization_service_records")
          .select("id, customer_id, service_name, service_date, amount_charged, amount_received, installments_total, customers(id, name), payments:organization_service_payments(id, installment_number, amount), scheduled_installments:organization_service_installments(id, installment_number, due_date, amount)")
          .eq("organization_id", organization.id)
          .order("service_date", { ascending: false })
          .limit(5000),
        admin.from("organization_business_expenses")
          .select("id, description, category, amount, expense_date, due_date, expense_type, payment_status")
          .eq("organization_id", organization.id)
          .eq("payment_status", "pendente")
          .order("due_date", { ascending: true })
          .limit(5000),
      ]);
      if (servicesResult.error || expensesResult.error) {
        console.error("Erro ao montar fluxo de caixa:", servicesResult.error, expensesResult.error);
        return fail("Não foi possível carregar a previsão de caixa.", 500);
      }
      const receivables = (servicesResult.data ?? []).filter((service) => Number(service.amount_charged) > Number(service.amount_received));
      return NextResponse.json({ ok: true, receivables, pendingExpenses: expensesResult.data ?? [] });
    }
    const month = params.get("month") ?? new Date().toISOString().slice(0, 7);
    let fromDate = params.get("from") ?? "";
    let toDate = params.get("to") ?? "";
    if (!fromDate && !toDate) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail("Informe um período válido.", 400);
      const [year, monthNumber] = month.split("-").map(Number);
      fromDate = `${month}-01`;
      toDate = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    }
    if (!validDate(fromDate) || !validDate(toDate) || fromDate > toDate) return fail("Informe as datas inicial e final válidas.", 400);

    const [servicesResult, paidExpensesResult, pendingExpensesResult, customersResult, paymentsResult, indicatorsResult, providerProfileResult] = await Promise.all([
      admin.from("organization_service_records")
        .select("id, customer_id, service_name, service_date, source, amount_charged, amount_received, direct_cost, installments_total, notes, created_at, customers(id, name), payments:organization_service_payments(id, installment_number, payment_method, payment_date, amount), scheduled_installments:organization_service_installments(id, installment_number, due_date, amount), cost_items:organization_service_cost_items(id, category, description, amount)")
        .eq("organization_id", organization.id)
        .gte("service_date", fromDate)
        .lte("service_date", toDate)
        .order("service_date", { ascending: false })
        .limit(5000),
      admin.from("organization_business_expenses")
        .select("id, description, category, amount, expense_date, due_date, expense_type, recurrence_group_id, classification, property_type, payment_status, notes, created_at")
        .eq("organization_id", organization.id)
        .eq("payment_status", "pago")
        .gte("expense_date", fromDate)
        .lte("expense_date", toDate)
        .order("expense_date", { ascending: false })
        .limit(5000),
      admin.from("organization_business_expenses")
        .select("id, description, category, amount, expense_date, due_date, expense_type, recurrence_group_id, classification, property_type, payment_status, notes, created_at")
        .eq("organization_id", organization.id)
        .eq("payment_status", "pendente")
        .gte("due_date", fromDate)
        .lte("due_date", toDate)
        .order("due_date", { ascending: true })
        .limit(5000),
      admin.from("customers")
        .select("id, name")
        .eq("organization_id", organization.id)
        .eq("status", "ativo")
        .order("name")
        .limit(1000),
      admin.from("organization_service_payments")
        .select("id, service_record_id, installment_number, payment_method, payment_date, amount, organization_service_records(service_name, customers(name))")
        .eq("organization_id", organization.id)
        .gte("payment_date", fromDate)
        .lte("payment_date", toDate)
        .order("payment_date", { ascending: false })
        .limit(5000),
      admin.rpc("get_organization_finance_indicators", { p_organization_id: organization.id }),
      admin.from("organization_public_profiles")
        .select("display_name, phone, whatsapp, email, address, logo_url")
        .eq("organization_id", organization.id)
        .maybeSingle(),
    ]);
    if (servicesResult.error || paidExpensesResult.error || pendingExpensesResult.error || customersResult.error || paymentsResult.error || indicatorsResult.error || providerProfileResult.error) {
      console.error("Erro ao carregar financeiro:", servicesResult.error, paidExpensesResult.error, pendingExpensesResult.error, customersResult.error, paymentsResult.error, indicatorsResult.error, providerProfileResult.error);
      return fail("Não foi possível carregar o financeiro. Confira se a atualização SQL foi aplicada no Supabase.", 500);
    }
    const expenses = [...(paidExpensesResult.data ?? []), ...(pendingExpensesResult.data ?? [])]
      .sort((a, b) => {
        const aDate = a.payment_status === "pago" ? a.expense_date : a.due_date ?? a.expense_date;
        const bDate = b.payment_status === "pago" ? b.expense_date : b.due_date ?? b.expense_date;
        return bDate.localeCompare(aDate);
      });
    return NextResponse.json({
      ok: true,
      organization,
      from: fromDate,
      to: toDate,
      organization_name: organization.name,
      provider_profile: providerProfileResult.data ?? null,
      services: servicesResult.data ?? [],
      expenses,
      customers: customersResult.data ?? [],
      payments: paymentsResult.data ?? [],
      indicators: indicatorsResult.data?.[0] ?? null,
    });
  } catch (error) {
    console.error("Erro na API GET do financeiro:", error);
    return fail("Ocorreu um erro ao carregar o financeiro.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getOwnerContext(request);
    if ("error" in context) return context.error;
    const { admin, organization } = context;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Dados da conta inválidos.", 400);
    const data = body as Record<string, unknown>;
    const expenseId = typeof data.expense_id === "string" ? data.expense_id.trim() : "";
    const paymentStatus = data.payment_status;
    const paidDate = data.paid_date;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expenseId)) return fail("Conta inválida.", 400);
    if (paymentStatus !== "pago" && paymentStatus !== "pendente") return fail("Situação inválida.", 400);
    if (paymentStatus === "pago" && !validDate(paidDate)) return fail("Informe a data do pagamento.", 400);
    const { data: existing, error: existingError } = await admin.from("organization_business_expenses")
      .select("id, due_date")
      .eq("id", expenseId)
      .eq("organization_id", organization.id)
      .maybeSingle();
    if (existingError || !existing) return fail("Conta a pagar não encontrada.", existingError ? 500 : 404);
    const { error } = await admin.from("organization_business_expenses").update({
      payment_status: paymentStatus,
      expense_date: paymentStatus === "pago" ? paidDate : existing.due_date,
      updated_at: new Date().toISOString(),
    }).eq("id", expenseId).eq("organization_id", organization.id);
    if (error) {
      console.error("Erro ao atualizar situação da conta:", error);
      return fail("Não foi possível atualizar a conta a pagar.", 500);
    }
    return NextResponse.json({ ok: true, message: paymentStatus === "pago" ? "Conta marcada como paga." : "Conta voltou para pendente." });
  } catch (error) {
    console.error("Erro ao atualizar conta financeira:", error);
    return fail("Ocorreu um erro ao atualizar a conta a pagar.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getOwnerContext(request);
    if ("error" in context) return context.error;
    const { admin, user, organization } = context;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Dados financeiros inválidos.", 400);
    const data = body as Record<string, unknown>;
    const recordType = data.type;

    if (recordType === "service") {
      const customerId = typeof data.customer_id === "string" ? data.customer_id.trim() : "";
      const serviceName = typeof data.service_name === "string" ? data.service_name.trim() : "";
      const source = typeof data.source === "string" ? data.source : "";
      const amountCharged = Number(data.amount_charged);
      const amountReceived = Number(data.amount_received);
      if (data.scheduled_installments !== undefined && (!Array.isArray(data.scheduled_installments) || data.scheduled_installments.some((item) => !item || typeof item !== "object" || Array.isArray(item)))) {
        return fail("A lista de parcelas ou custos está inválida.", 400);
      }
      if (data.cost_items !== undefined && (!Array.isArray(data.cost_items) || data.cost_items.some((item) => !item || typeof item !== "object" || Array.isArray(item)))) {
        return fail("A lista de parcelas ou custos está inválida.", 400);
      }
      const scheduledInstallments = Array.isArray(data.scheduled_installments) ? data.scheduled_installments as Array<Record<string, unknown>> : [];
      const costItems = Array.isArray(data.cost_items) ? data.cost_items as Array<Record<string, unknown>> : [];
      const installmentsTotal = Math.max(1, scheduledInstallments.length);
      const initialPaymentMethod = typeof data.payment_method === "string" ? data.payment_method : "";
      const initialPaymentDate = data.initial_payment_date;
      const notes = typeof data.notes === "string" ? data.notes.trim() : "";
      const normalizedInstallments = scheduledInstallments.map((item) => ({ amount: Number(item.amount), due_date: item.due_date }));
      const normalizedCostItems = costItems.map((item) => ({
        category: typeof item.category === "string" ? item.category : "",
        description: typeof item.description === "string" ? item.description.trim() : "",
        amount: Number(item.amount),
      }));
      const directCost = normalizedCostItems.reduce((total, item) => total + item.amount, 0);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(customerId)) return fail("Selecione um cliente cadastrado.", 400);
      if (serviceName.length < 2 || serviceName.length > 200) return fail("O nome do serviço deve ter entre 2 e 200 caracteres.", 400);
      if (!validDate(data.service_date)) return fail("Informe uma data válida para o serviço.", 400);
      if (!(sources as readonly string[]).includes(source)) return fail("Selecione uma origem válida para o cliente.", 400);
      if (!Number.isFinite(amountCharged) || amountCharged <= 0 || !Number.isFinite(amountReceived) || amountReceived < 0 || amountReceived > amountCharged) return fail("Confira os valores cobrados e recebidos.", 400);
      if (scheduledInstallments.length > 24 || normalizedInstallments.some((item) => !Number.isFinite(item.amount) || item.amount <= 0 || !validDate(item.due_date))) return fail("Confira os valores e vencimentos das parcelas.", 400);
      const scheduledTotal = normalizedInstallments.reduce((total, item) => total + item.amount, 0);
      if (amountReceived + scheduledTotal > amountCharged + 0.005) return fail("A entrada e as parcelas não podem ultrapassar o valor cobrado.", 400);
      if (costItems.length > 30 || normalizedCostItems.some((item) => !(costCategories as readonly string[]).includes(item.category) || item.description.length < 2 || item.description.length > 200 || !Number.isFinite(item.amount) || item.amount <= 0)) return fail("Confira a categoria, descrição e valor dos custos diretos.", 400);
      if (amountReceived > 0 && !(paymentMethods as readonly string[]).includes(initialPaymentMethod)) return fail("Selecione o meio de pagamento do valor já recebido.", 400);
      if (amountReceived > 0 && !validDate(initialPaymentDate)) return fail("Informe a data da entrada recebida.", 400);
      if (notes.length > 2000) return fail("As observações devem ter no máximo 2.000 caracteres.", 400);

      const { data: customer, error: customerError } = await admin.from("customers")
        .select("id").eq("id", customerId).eq("organization_id", organization.id).maybeSingle();
      if (customerError || !customer) return fail("O cliente selecionado não pertence à organização.", 400);
      const { data: service, error } = await admin.from("organization_service_records").insert({
        organization_id: organization.id,
        customer_id: customerId,
        service_name: serviceName,
        service_date: data.service_date,
        source,
        amount_charged: amountCharged,
        amount_received: 0,
        direct_cost: directCost,
        installments_total: installmentsTotal,
        notes: notes || null,
        created_by: user.id,
      }).select("id, customer_id, service_name, service_date, source, amount_charged, amount_received, direct_cost, installments_total, notes, created_at, customers(id, name)").single();
      if (error) {
        console.error("Erro ao registrar serviço financeiro:", error);
        return fail("Não foi possível registrar o serviço.", 500);
      }
      if (amountReceived > 0) {
        const { error: paymentError } = await admin.rpc("record_organization_service_payment", {
          p_organization_id: organization.id,
          p_service_record_id: service.id,
          p_installment_number: 0,
          p_installments_total: installmentsTotal,
          p_payment_method: initialPaymentMethod,
          p_payment_date: initialPaymentDate,
          p_amount: amountReceived,
          p_created_by: user.id,
        });
        if (paymentError) {
          console.error("Erro ao registrar recebimento inicial:", paymentError);
          await admin.from("organization_service_records").delete().eq("id", service.id).eq("organization_id", organization.id);
          return fail("O serviço não foi registrado porque não foi possível salvar o recebimento. Confira a atualização SQL de parcelas.", 500);
        }
      }
      const scheduleRows = normalizedInstallments.map((item, index) => ({
        organization_id: organization.id,
        service_record_id: service.id,
        installment_number: index + 1,
        due_date: item.due_date,
        amount: item.amount,
      }));
      if (scheduleRows.length) {
        const { error: scheduleError } = await admin.from("organization_service_installments").insert(scheduleRows);
        if (scheduleError) {
          console.error("Erro ao salvar vencimentos do serviço:", scheduleError);
          await admin.from("organization_service_records").delete().eq("id", service.id).eq("organization_id", organization.id);
          return fail("O serviço não foi registrado porque não foi possível salvar os vencimentos. Confira a atualização SQL de detalhamento financeiro.", 500);
        }
      }
      if (normalizedCostItems.length) {
        const costRows = normalizedCostItems.map((item) => ({
          organization_id: organization.id,
          service_record_id: service.id,
          category: item.category,
          description: item.description,
          amount: item.amount,
        }));
        const { error: costError } = await admin.from("organization_service_cost_items").insert(costRows);
        if (costError) {
          console.error("Erro ao salvar itens de custo direto:", costError);
          await admin.from("organization_service_records").delete().eq("id", service.id).eq("organization_id", organization.id);
          return fail("O serviço não foi registrado porque não foi possível salvar os custos detalhados. Confira a atualização SQL de detalhamento financeiro.", 500);
        }
      }
      if (directCost > 0) {
        const { error: totalCostError } = await admin.from("organization_service_records")
          .update({ direct_cost: directCost }).eq("id", service.id).eq("organization_id", organization.id);
        if (totalCostError) {
          await admin.from("organization_service_records").delete().eq("id", service.id).eq("organization_id", organization.id);
          return fail("Não foi possível atualizar o total dos custos diretos.", 500);
        }
      }
      const { data: savedService } = await admin.from("organization_service_records")
        .select("id, customer_id, service_name, service_date, source, amount_charged, amount_received, direct_cost, installments_total, notes, created_at, customers(id, name), payments:organization_service_payments(id, installment_number, payment_method, payment_date, amount), scheduled_installments:organization_service_installments(id, installment_number, due_date, amount), cost_items:organization_service_cost_items(id, category, description, amount)")
        .eq("id", service.id).eq("organization_id", organization.id).single();
      return NextResponse.json({ ok: true, service: savedService ?? service, message: "Serviço registrado no financeiro." }, { status: 201 });
    }

    if (recordType === "payment") {
      const serviceRecordId = typeof data.service_record_id === "string" ? data.service_record_id.trim() : "";
      const installmentNumber = Number(data.installment_number);
      const installmentsTotal = Number(data.installments_total);
      const paymentMethod = typeof data.payment_method === "string" ? data.payment_method : "";
      const amount = Number(data.amount);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(serviceRecordId)) return fail("Serviço inválido.", 400);
      if (!Number.isInteger(installmentNumber) || !Number.isInteger(installmentsTotal) || installmentNumber < 1 || installmentNumber > installmentsTotal || installmentsTotal > 24) return fail("Informe uma parcela válida (de 1 a 24).", 400);
      if (!(paymentMethods as readonly string[]).includes(paymentMethod)) return fail("Selecione um meio de pagamento válido.", 400);
      if (!validDate(data.payment_date) || !Number.isFinite(amount) || amount <= 0) return fail("Informe data e valor válidos para o recebimento.", 400);
      const { error } = await admin.rpc("record_organization_service_payment", {
        p_organization_id: organization.id,
        p_service_record_id: serviceRecordId,
        p_installment_number: installmentNumber,
        p_installments_total: installmentsTotal,
        p_payment_method: paymentMethod,
        p_payment_date: data.payment_date,
        p_amount: amount,
        p_created_by: user.id,
      });
      if (error) {
        console.error("Erro ao registrar recebimento:", error);
        const message = error.message.includes("PAYMENT_EXCEEDS_BALANCE")
          ? "O valor recebido não pode ultrapassar o saldo pendente."
          : error.message.includes("PAYMENT_EXCEEDS_INSTALLMENT")
            ? "O valor informado ultrapassa o saldo desta parcela."
          : error.message.includes("INVALID_INSTALLMENT")
            ? "A parcela informada não corresponde ao plano escolhido."
            : "Não foi possível registrar o recebimento. Confira a atualização SQL de parcelas.";
        return fail(message, error.message.includes("PAYMENT_EXCEEDS_BALANCE") || error.message.includes("PAYMENT_EXCEEDS_INSTALLMENT") ? 400 : 500);
      }
      return NextResponse.json({ ok: true, message: "Recebimento registrado." });
    }

    if (recordType === "expense") {
      const description = typeof data.description === "string" ? data.description.trim() : "";
      const category = typeof data.category === "string" ? data.category.trim() : "";
      const amount = Number(data.amount);
      const paymentStatus = typeof data.payment_status === "string" ? data.payment_status : "";
      const expenseType = data.expense_type === "fixa_mensal" ? "fixa_mensal" : "avulsa";
      const classifications = ["despesa_fixa", "despesa_variavel", "operacional", "pessoal", "comercial_marketing", "nao_operacional", "financeira"] as const;
      const propertyTypes = ["alugado", "proprio", "nao_aplica"] as const;
      const classification = typeof data.classification === "string" ? data.classification : expenseType === "fixa_mensal" ? "despesa_fixa" : "despesa_variavel";
      const propertyType = typeof data.property_type === "string" ? data.property_type : "nao_aplica";
      const recurrenceMonths = expenseType === "fixa_mensal" ? Number(data.recurrence_months) : 1;
      const dueDate = validDate(data.due_date) ? data.due_date : data.expense_date;
      const notes = typeof data.notes === "string" ? data.notes.trim() : "";
      if (description.length < 2 || description.length > 200 || category.length < 2 || category.length > 80) return fail("Informe uma descrição e uma categoria válidas.", 400);
      if (!validDate(dueDate)) return fail("Informe uma data válida para o vencimento.", 400);
      if (!Number.isFinite(amount) || amount <= 0) return fail("O valor do gasto deve ser maior que zero.", 400);
      if (!(paymentStatuses as readonly string[]).includes(paymentStatus)) return fail("Selecione se o gasto foi pago ou está pendente.", 400);
      if (!(classifications as readonly string[]).includes(classification)) return fail("Selecione uma classificação válida para a despesa.", 400);
      if (!(propertyTypes as readonly string[]).includes(propertyType)) return fail("Selecione uma opção válida para o tipo de imóvel.", 400);
      if (paymentStatus === "pago" && !validDate(data.expense_date)) return fail("Informe uma data válida para o pagamento.", 400);
      if (expenseType === "fixa_mensal" && (!Number.isInteger(recurrenceMonths) || recurrenceMonths < 1 || recurrenceMonths > 24)) return fail("Escolha de 1 a 24 meses para programar a conta fixa.", 400);
      if (notes.length > 2000) return fail("As observações devem ter no máximo 2.000 caracteres.", 400);
      const recurrenceGroupId = expenseType === "fixa_mensal" ? randomUUID() : null;
      const entries = Array.from({ length: recurrenceMonths }, (_, index) => {
        const occurrenceDueDate = monthlyDueDate(dueDate as string, index);
        const isFirst = index === 0;
        const status = isFirst ? paymentStatus : "pendente";
        return {
          organization_id: organization.id,
          description,
          category,
          amount,
          expense_date: status === "pago" ? data.expense_date : occurrenceDueDate,
          due_date: occurrenceDueDate,
          expense_type: expenseType,
          recurrence_group_id: recurrenceGroupId,
          classification,
          property_type: propertyType,
          payment_status: status,
          notes: notes || null,
          created_by: user.id,
        };
      });
      const { data: expenses, error } = await admin.from("organization_business_expenses").insert(entries)
        .select("id, description, category, amount, expense_date, due_date, expense_type, recurrence_group_id, classification, property_type, payment_status, notes, created_at");
      if (error) {
        console.error("Erro ao registrar despesa:", error);
        return fail("Não foi possível registrar o gasto.", 500);
      }
      return NextResponse.json({ ok: true, expenses, message: expenseType === "fixa_mensal" ? `Conta fixa programada para ${recurrenceMonths} mês(es).` : "Gasto registrado no financeiro." }, { status: 201 });
    }

    return fail("Tipo de registro financeiro inválido.", 400);
  } catch (error) {
    console.error("Erro na API POST do financeiro:", error);
    return fail("Ocorreu um erro ao registrar os dados financeiros.", 500);
  }
}
