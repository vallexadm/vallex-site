"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SystemBrand from "@/components/SystemBrand";
import { createClient } from "@supabase/supabase-js";
import { calculateFuelCost, type FuelCostDetails } from "@/lib/fuel-cost";
import { quoteCostCategories, type QuoteInternalCost } from "@/lib/orcamento-custos";

type QuoteCostForm = {
  id: string;
  category: QuoteInternalCost["category"];
  description: string;
  amount: string;
  distance_km: string;
  fuel_type: FuelCostDetails["fuel_type"];
  price_per_liter: string;
  efficiency_km_per_liter: string;
};

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
};

type Orcamento = {
  id: string;
  customer_id: string;
  titulo: string;
  descricao: string | null;
  valor: number;
  valor_servico?: number;
  custos_internos?: QuoteInternalCost[];
  status: string;
  validade_ate: string | null;
  observacoes: string | null;
  created_at: string;
  customers:
    | {
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
      }
    | null;
};

type AnexoOrcamento = { path: string; name: string; signed_url: string };

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

const statusStyles: Record<string, string> = {
  rascunho: "bg-purple-50 text-purple-700",
  enviado: "bg-blue-50 text-blue-700",
  aprovado: "bg-green-50 text-green-700",
  recusado: "bg-red-50 text-red-700",
  cancelado: "bg-slate-100 text-slate-600",
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

const quoteCostLabels: Record<QuoteInternalCost["category"], string> = {
  materiais_insumos: "Materiais e insumos",
  taxas_cartorio: "Taxas e cartório",
  transporte: "Transporte",
  ferramentas_equipamentos: "Ferramentas e equipamentos",
  terceirizados: "Serviços terceirizados",
  alimentacao_hospedagem: "Alimentação e hospedagem",
  outros: "Outros custos",
};

function parseMoney(value: string) {
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value;
  return Number(normalized);
}

function makeCostForm(item?: QuoteInternalCost): QuoteCostForm {
  return {
    id: crypto.randomUUID(),
    category: item?.category ?? "materiais_insumos",
    description: item?.description ?? "",
    amount: item ? String(item.amount).replace(".", ",") : "",
    distance_km: item?.fuel_details ? String(item.fuel_details.distance_km).replace(".", ",") : "",
    fuel_type: item?.fuel_details?.fuel_type ?? "gasolina",
    price_per_liter: item?.fuel_details ? String(item.fuel_details.price_per_liter).replace(".", ",") : "",
    efficiency_km_per_liter: item?.fuel_details ? String(item.fuel_details.efficiency_km_per_liter).replace(".", ",") : "",
  };
}

export default function OrcamentosPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [role, setRole] = useState<"owner" | "member" | "">("");
  
  const [editingId, setEditingId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [custosInternos, setCustosInternos] = useState<QuoteCostForm[]>([]);
  const [validadeAte, setValidadeAte] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [anexos, setAnexos] = useState<AnexoOrcamento[]>([]);
  const [arquivosSelecionados, setArquivosSelecionados] = useState<File[]>([]);

  const [status, setStatus] = useState("rascunho");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const editParamHandled = useRef(false);
  const custosInternosTotal = useMemo(() => custosInternos.reduce((sum, item) => {
    const amount = item.category === "transporte"
      ? calculateFuelCost({ distance_km: item.distance_km, fuel_type: item.fuel_type, price_per_liter: item.price_per_liter, efficiency_km_per_liter: item.efficiency_km_per_liter })
      : parseMoney(item.amount);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0), [custosInternos]);
  const valorOrcamentoTotal = (Number.isFinite(parseMoney(valor)) ? parseMoney(valor) : 0) + custosInternosTotal;

  const filteredOrcamentos = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return orcamentos;
    }

    return orcamentos.filter((orcamento) => {
      const customerName = orcamento.customers?.name ?? "";

      return (
        customerName.toLowerCase().includes(normalizedSearch) ||
        orcamento.titulo.toLowerCase().includes(normalizedSearch) ||
        orcamento.status.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [orcamentos, search]);

  async function getAccessToken() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Configuração do Supabase não encontrada.");
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      }
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? "";
  }

  async function loadData(showLoading = false) {
    try {
      const accessToken = await getAccessToken();

      if (showLoading) setLoading(true);
      setError("");

      if (!accessToken) {
        setError("Sessão não encontrada. Faça login novamente.");
        return;
      }

      const [customersResponse, orcamentosResponse] =
        await Promise.all([
          fetch("/api/sistema/orcamentos?dados=clientes", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }),
          fetch("/api/sistema/orcamentos", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }),
        ]);

      const customersResult = await customersResponse.json();
      const orcamentosResult = await orcamentosResponse.json();

      if (!customersResponse.ok || !customersResult.ok) {
        setError(
          customersResult.message ??
            "Não foi possível carregar os clientes."
        );
        return;
      }

      if (!orcamentosResponse.ok || !orcamentosResult.ok) {
        setError(
          orcamentosResult.message ??
            "Não foi possível carregar os orçamentos."
        );
        return;
      }

      setCustomers(customersResult.customers ?? []);
      setOrcamentos(orcamentosResult.orcamentos ?? []);
      setRole(orcamentosResult.role === "owner" ? "owner" : "member");
      const requestedId = new URLSearchParams(window.location.search).get("editar");
      if (requestedId && !editParamHandled.current) {
        const requestedQuote = (orcamentosResult.orcamentos ?? []).find(
          (quote: Orcamento) => quote.id === requestedId
        );
        if (requestedQuote) {
          editParamHandled.current = true;
          void handleEdit(requestedQuote);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar orçamentos:", error);
      setError("Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
    // This page loads once on mount; later refreshes are triggered by form actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  setError("");
  setMessage("");
  setSending(true);

  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      setError("Sessão não encontrada. Faça login novamente.");
      return;
    }

    const isEditing = Boolean(editingId);

    const response = await fetch("/api/sistema/orcamentos", {
      method: isEditing ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        ...(isEditing ? { id: editingId } : {}),
        customer_id: customerId,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        valor: valorOrcamentoTotal,
        valor_servico: parseMoney(valor),
        custos_internos: custosInternos.map((item) => {
          const fuelDetails: FuelCostDetails = {
            distance_km: item.distance_km,
            fuel_type: item.fuel_type,
            price_per_liter: item.price_per_liter,
            efficiency_km_per_liter: item.efficiency_km_per_liter,
          };
          return {
            category: item.category,
            description: item.description.trim(),
            amount: item.category === "transporte" ? calculateFuelCost(fuelDetails) : parseMoney(item.amount),
            ...(item.category === "transporte" ? { fuel_details: {
              distance_km: parseMoney(item.distance_km),
              fuel_type: item.fuel_type,
              price_per_liter: parseMoney(item.price_per_liter),
              efficiency_km_per_liter: parseMoney(item.efficiency_km_per_liter),
            } } : {}),
          };
        }),
        validade_ate: validadeAte || null,
        observacoes: observacoes.trim(),
        status: role === "member" ? "enviado" : status,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(
        data.message ||
          (isEditing
            ? "Não foi possível atualizar o orçamento."
            : "Não foi possível cadastrar o orçamento.")
      );
      return;
    }

    const savedQuoteId = editingId ?? data.orcamento?.id;
    if (!savedQuoteId) {
      throw new Error("O orçamento foi salvo, mas não recebemos o identificador para anexar arquivos.");
    }

    for (const file of [...arquivosSelecionados]) {
      const form = new FormData();
      form.set("finalidade", "orcamento");
      form.set("orcamento_id", savedQuoteId);
      form.set("arquivo", file);
      const uploadResponse = await fetch("/api/sistema/arquivos", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadResult.message || `Não foi possível anexar ${file.name}.`);
      }
      setArquivosSelecionados((current) => current.filter((item) => item !== file));
      if (uploadResult.arquivo) setAnexos((current) => [...current, uploadResult.arquivo]);
    }

    if (role === "owner") {
      setEditingId(savedQuoteId);
      await carregarAnexos(savedQuoteId, accessToken);
    } else {
      setEditingId(null);
      setCustomerId("");
      setTitulo("");
      setDescricao("");
      setValor("");
      setCustosInternos([]);
      setValidadeAte("");
      setObservacoes("");
      setStatus("rascunho");
    }
    setMessage(isEditing
      ? "Orçamento atualizado com sucesso."
      : role === "member"
        ? "Proposta enviada ao proprietário para aprovação."
        : "Rascunho criado. Complete os dados, anexe os arquivos e envie ao cliente pelo WhatsApp.");

    await loadData(true);
  } catch (error) {
    console.error("Erro ao salvar orçamento:", error);
    setError(error instanceof Error ? error.message : "Erro de comunicação ao salvar o orçamento.");
  } finally {
    setSending(false);
  }
}
  async function carregarAnexos(id: string, accessToken?: string) {
    const token = accessToken || await getAccessToken();
    if (!token) return;
    const response = await fetch(`/api/sistema/arquivos?orcamento_id=${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Não foi possível carregar os anexos.");
    setAnexos(result.arquivos ?? []);
  }

  async function handleEdit(orcamento: Orcamento) {
        setError("");
        setMessage("");
        setEditingId(orcamento.id);

        setCustomerId(orcamento.customer_id);
        setTitulo(orcamento.titulo);
        setDescricao(orcamento.descricao ?? "");
        setValor(String(orcamento.valor_servico ?? orcamento.valor).replace(".", ","));
        setCustosInternos((orcamento.custos_internos ?? []).map((item) => makeCostForm(item)));
        setValidadeAte(orcamento.validade_ate ?? "");
        setObservacoes(orcamento.observacoes ?? "");
        setStatus(orcamento.status);
        setArquivosSelecionados([]);
        if (role === "owner") {
          try {
            await carregarAnexos(orcamento.id);
          } catch (error) {
            setError(error instanceof Error ? error.message : "Não foi possível carregar os anexos.");
          }
        }

        window.scrollTo({
        top: 0,
        behavior: "smooth",
    });
    }

  async function removerAnexo(anexo: AnexoOrcamento) {
    if (!editingId) return;
    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/sistema/arquivos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ orcamento_id: editingId, path: anexo.path }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Não foi possível remover o anexo.");
      setAnexos((current) => current.filter((item) => item.path !== anexo.path));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível remover o anexo.");
    }
  }

  async function enviarOrcamento(orcamento: Orcamento) {
    if (role !== "owner") return;
    const tab = window.open("about:blank", "_blank");
    setError("");
    setMessage("");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Sessão não encontrada. Faça login novamente.");
      const filesResponse = await fetch(`/api/sistema/arquivos?orcamento_id=${encodeURIComponent(orcamento.id)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store",
      });
      const filesResult = await filesResponse.json();
      if (!filesResponse.ok) throw new Error(filesResult.message || "Não foi possível preparar os anexos.");

      const arquivos = filesResult.arquivos ?? [];
      let anexosTexto = "";
      if (arquivos.length > 0) {
        const linksResponse = await fetch("/api/sistema/arquivos", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ acao: "links_compartilhamento", orcamento_id: orcamento.id }),
        });
        const linksResult = await linksResponse.json();
        if (!linksResponse.ok) throw new Error(linksResult.message || "Não foi possível criar os links curtos dos anexos.");
        anexosTexto = (linksResult.links ?? [])
          .map((file: { name: string; url: string }, index: number) => `\nAnexo ${index + 1}: ${file.url}`)
          .join("");
      }
      const validadeTexto = orcamento.validade_ate ? `\nVálido até: ${formatDate(orcamento.validade_ate)}` : "";
      const resumo = orcamento.descricao?.trim().slice(0, 350);
      const texto = `Olá, ${orcamento.customers?.name ?? "tudo bem"}! Segue o orçamento: ${orcamento.titulo}\nValor: ${formatCurrency(orcamento.valor)}${validadeTexto}${resumo ? `\n\nDetalhes: ${resumo}${orcamento.descricao && orcamento.descricao.length > 350 ? "…" : ""}` : ""}${anexosTexto}\n\nEm caso de dúvidas, estou à disposição.`;
      const phone = (orcamento.customers?.phone ?? "").replace(/\D/g, "");
      const phoneWithCountry = phone.length === 10 || phone.length === 11 ? `55${phone}` : phone;
      const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(texto)}`;
      if (tab) tab.location.href = whatsappUrl;
      else window.location.href = whatsappUrl;
      setMessage("Revise a mensagem e toque em enviar no WhatsApp. Depois, atualize o status do orçamento no sistema.");
    } catch (error) {
      tab?.close();
      setError(error instanceof Error ? error.message : "Não foi possível preparar o envio.");
    }
  }

  async function handleApprove(orcamento: Orcamento) {
    setError("");
    setMessage("");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Sessão não encontrada. Faça login novamente.");
      const response = await fetch("/api/sistema/orcamentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          id: orcamento.id,
          customer_id: orcamento.customer_id,
          titulo: orcamento.titulo,
          descricao: orcamento.descricao ?? "",
          observacoes: orcamento.observacoes ?? "",
          valor: orcamento.valor,
          valor_servico: orcamento.valor_servico ?? orcamento.valor,
          custos_internos: orcamento.custos_internos ?? [],
          validade_ate: orcamento.validade_ate,
          status: "aprovado",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível aprovar a proposta.");
      setMessage("Proposta aprovada pelo proprietário.");
      await loadData(true);
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Não foi possível aprovar a proposta.");
    }
  }
        async function handleDelete(id: string) {
  const confirmed = window.confirm(
    "Tem certeza que deseja excluir este orçamento?"
  );

  if (!confirmed) {
    return;
  }

  setError("");
  setMessage("");

  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      setError("Sessão não encontrada. Faça login novamente.");
      return;
    }

    const response = await fetch("/api/sistema/orcamentos", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ id }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.message || "Não foi possível excluir o orçamento.");
      return;
    }

    setMessage("Orçamento excluído com sucesso.");

    if (editingId === id) {
      setEditingId(null);
      setCustomerId("");
      setTitulo("");
      setDescricao("");
      setValor("");
      setCustosInternos([]);
      setValidadeAte("");
      setObservacoes("");
      setStatus("rascunho");
    }

    await loadData(true);
  } catch (error) {
    console.error("Erro ao excluir orçamento:", error);
    setError("Erro de comunicação ao excluir o orçamento.");
  }
}

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-purple-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <SystemBrand />

          <Link
            href="/sistema"
            className="inline-flex items-center gap-2 rounded-lg border border-purple-300 px-5 py-3 text-sm font-medium transition hover:bg-purple-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#17002E]"
          >
            <span aria-hidden="true">←</span> Voltar ao painel
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Gestão da organização
          </p>

          <h1 className="mt-2 text-4xl font-bold text-slate-950">
            Orçamentos
          </h1>

          <p className="mt-3 text-lg text-slate-600">
            {role === "member"
              ? "Prepare propostas para o proprietário revisar e aprovar."
              : "Registre, revise e aprove propostas da organização."}
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">
            {message}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-purple-100 bg-white p-7 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950">
            {role === "member" ? "Enviar proposta para aprovação" : "Cadastrar orçamento"}
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            {role === "member"
              ? "Escolha um cliente da organização e envie os detalhes ao proprietário. O cliente não recebe a proposta até ela ser aprovada."
              : "Prepare a proposta, anexe documentos e envie uma mensagem pronta ao cliente pelo WhatsApp."}
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-6"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Cliente *
                </label>

                <select
                  value={customerId}
                  onChange={(event) =>
                    setCustomerId(event.target.value)
                  }
                  required
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-purple-500"
                >
                  <option value="">
                    Selecione um cliente
                  </option>

                  {customers.map((customer) => (
                    <option
                      key={customer.id}
                      value={customer.id}
                    >
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Título *
                </label>

                <input
                  value={titulo}
                  onChange={(event) =>
                    setTitulo(event.target.value)
                  }
                  required
                  maxLength={200}
                  placeholder="Ex.: Instalação elétrica"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Valor do serviço *
                </label>

                <input
                  value={valor}
                  onChange={(event) =>
                    setValor(event.target.value)
                  }
                  required
                  inputMode="decimal"
                  placeholder="0,00"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-purple-500"
                />
                <p className="mt-1 text-xs text-slate-500">Valor antes dos custos internos.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Validade
                </label>

                <input
                  type="date"
                  value={validadeAte}
                  onChange={(event) =>
                    setValidadeAte(event.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-purple-500"
                />
              </div>
              {role === "owner" ? <div>
  <label className="block text-sm font-medium text-slate-700">
    Status do orçamento
  </label>

  <select
    value={status}
    onChange={(event) => setStatus(event.target.value)}
    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-purple-500"
  >
    <option value="rascunho">Rascunho</option>
    <option value="enviado">Enviado</option>
    <option value="aprovado">Aprovado</option>
    <option value="recusado">Recusado</option>
    <option value="cancelado">Cancelado</option>
  </select>
              </div> : (
                <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
                  Sua proposta será enviada ao proprietário como pendente de aprovação.
                </p>
              )}
            </div>

            <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">Custos internos do prestador</h3>
                  <p className="mt-1 text-sm text-slate-600">Esses itens e cálculos ficam só no painel. O cliente recebe apenas o valor final do orçamento.</p>
                </div>
                <button type="button" onClick={() => setCustosInternos((current) => [...current, makeCostForm()])} disabled={custosInternos.length >= 30} className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 disabled:opacity-50">Adicionar custo</button>
              </div>

              <div className="mt-4 space-y-4">
                {custosInternos.map((item, index) => {
                  const fuelDetails: FuelCostDetails = { distance_km: item.distance_km, fuel_type: item.fuel_type, price_per_liter: item.price_per_liter, efficiency_km_per_liter: item.efficiency_km_per_liter };
                  const calculatedFuel = calculateFuelCost(fuelDetails);
                  const updateItem = (changes: Partial<QuoteCostForm>) => setCustosInternos((current) => current.map((row) => row.id === item.id ? { ...row, ...changes } : row));
                  return (
                    <div key={item.id} className="rounded-lg border border-amber-200 bg-white p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="text-sm font-medium text-slate-700">Categoria
                          <select value={item.category} onChange={(event) => updateItem({ category: event.target.value as QuoteCostForm["category"] })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
                            {quoteCostCategories.map((category) => <option key={category} value={category}>{quoteCostLabels[category]}</option>)}
                          </select>
                        </label>
                        <label className="text-sm font-medium text-slate-700">Descrição
                          <input required minLength={2} maxLength={200} value={item.description} onChange={(event) => updateItem({ description: event.target.value })} placeholder={item.category === "transporte" ? "Ex.: Deslocamento até o cliente" : "Ex.: Material ou taxa"} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                        </label>

                        {item.category === "transporte" ? <>
                          <label className="text-sm font-medium text-slate-700">Distância total (km)
                            <input required type="number" min="0.1" step="0.1" value={item.distance_km} onChange={(event) => updateItem({ distance_km: event.target.value })} placeholder="Ex.: 24" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm font-medium text-slate-700">Combustível
                            <select value={item.fuel_type} onChange={(event) => updateItem({ fuel_type: event.target.value as FuelCostDetails["fuel_type"] })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="gasolina">Gasolina</option><option value="etanol">Etanol (álcool)</option></select>
                          </label>
                          <label className="text-sm font-medium text-slate-700">Preço por litro (R$)
                            <input required type="number" min="0.01" step="0.01" value={item.price_per_liter} onChange={(event) => updateItem({ price_per_liter: event.target.value })} placeholder="Ex.: 5,89" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                          </label>
                          <label className="text-sm font-medium text-slate-700">Consumo médio (km/L)
                            <input required type="number" min="0.1" step="0.1" value={item.efficiency_km_per_liter} onChange={(event) => updateItem({ efficiency_km_per_liter: event.target.value })} placeholder="Ex.: 10,5" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                          </label>
                          <p className="self-end rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-950 md:col-span-2">Custo estimado do combustível: <strong>{formatCurrency(calculatedFuel)}</strong></p>
                        </> : <label className="text-sm font-medium text-slate-700">Valor (R$)
                          <input required type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => updateItem({ amount: event.target.value })} placeholder="Ex.: 35,00" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                        </label>}
                      </div>
                      <button type="button" onClick={() => setCustosInternos((current) => current.filter((row) => row.id !== item.id))} className="mt-3 text-sm font-medium text-red-700">Remover custo {index + 1}</button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-2 border-t border-amber-200 pt-4 text-sm sm:grid-cols-3">
                <p>Serviço: <strong>{formatCurrency(Number.isFinite(parseMoney(valor)) ? parseMoney(valor) : 0)}</strong></p>
                <p>Custos internos: <strong>{formatCurrency(custosInternosTotal)}</strong></p>
                <p className="text-purple-900">Total do orçamento: <strong>{formatCurrency(valorOrcamentoTotal)}</strong></p>
              </div>
              <p className="mt-2 text-xs text-slate-500">O total do orçamento é o valor que será apresentado ao cliente.</p>
            </section>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Descrição
              </label>

              <textarea
                value={descricao}
                onChange={(event) =>
                  setDescricao(event.target.value)
                }
                rows={4}
                maxLength={5000}
                placeholder="Descreva os serviços ou produtos incluídos no orçamento."
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Observações
              </label>

              <textarea
                value={observacoes}
                onChange={(event) =>
                  setObservacoes(event.target.value)
                }
                rows={3}
                maxLength={5000}
                placeholder="Condições, prazos ou informações adicionais."
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-purple-500"
              />
            </div>

            {role === "owner" && <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4 sm:p-5">
              <label htmlFor="quote-files" className="block text-sm font-semibold text-slate-800">
                Anexos do orçamento
              </label>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                PDF, JPG, PNG ou WebP. Até 10 MB por arquivo; os links enviados ao cliente ficam disponíveis por 7 dias.
              </p>
              <input
                id="quote-files"
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp"
                disabled={sending}
                onChange={(event) => {
                  const chosen = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (chosen.length + anexos.length > 5) {
                    setError("Este orçamento pode ter até 5 anexos.");
                    return;
                  }
                  const invalid = chosen.find((file) => file.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type));
                  if (invalid) {
                    setError(`${invalid.name} não é um formato aceito ou ultrapassa 10 MB.`);
                    return;
                  }
                  setError("");
                  setArquivosSelecionados((current) => [...current, ...chosen]);
                }}
                className="mt-3 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-purple-100 file:px-3 file:py-2 file:font-semibold file:text-purple-800"
              />
              {arquivosSelecionados.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {arquivosSelecionados.map((file, index) => (
                    <li key={`${file.name}-${file.lastModified}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                      <span className="min-w-0 break-all">{file.name}</span>
                      <button type="button" onClick={() => setArquivosSelecionados((current) => current.filter((_, i) => i !== index))} className="text-xs font-semibold text-red-700">Remover</button>
                    </li>
                  ))}
                </ul>
              )}
              {anexos.length > 0 && (
                <div className="mt-4 border-t border-purple-100 pt-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Arquivos já salvos</p>
                  <ul className="mt-2 space-y-2">
                    {anexos.map((file) => (
                      <li key={file.path} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                        <a href={file.signed_url} target="_blank" rel="noreferrer" className="min-w-0 break-all text-purple-700 underline">{file.name}</a>
                        <button type="button" onClick={() => void removerAnexo(file)} className="text-xs font-semibold text-red-700">Excluir</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>}

            <button
              type="submit"
              disabled={sending}
              className="rounded-lg bg-purple-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending
                ? "Salvando..."
                : editingId
                  ? "Salvar orçamento"
                  : role === "member"
                    ? "Enviar proposta para aprovação"
                    : "Criar rascunho e salvar orçamento" }
            </button>
          </form>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">
                Orçamentos cadastrados
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                {filteredOrcamentos.length}{" "}
                {filteredOrcamentos.length === 1
                  ? "orçamento"
                  : "orçamentos"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Buscar orçamento
              </label>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Cliente, título ou status"
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-purple-500 md:w-80"
              />
            </div>
          </div>

          {loading ? (
            <div className="mt-6 rounded-xl bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              Carregando orçamentos...
            </div>
          ) : filteredOrcamentos.length === 0 ? (
            <div className="mt-6 rounded-xl bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              Nenhum orçamento cadastrado ainda.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
  <thead>
    <tr className="border-b border-slate-200 text-slate-500">
      <th className="px-3 py-4 font-medium">
        Cliente
      </th>

      <th className="px-3 py-4 font-medium">
        Título
      </th>

      <th className="px-3 py-4 font-medium">
        Valor
      </th>

      <th className="px-3 py-4 font-medium">
        Status
      </th>

      <th className="px-3 py-4 font-medium">
        Validade
      </th>

      <th className="px-3 py-4 font-medium">
        Cadastro
      </th>

      <th className="px-3 py-4 text-right font-medium">Ações</th>
    </tr>
  </thead>

  <tbody>
    {filteredOrcamentos.map((orcamento) => (
      <tr
        key={orcamento.id}
        className="border-b border-slate-100"
      >
        <td className="px-3 py-4 font-medium text-slate-900">
          {orcamento.customers?.name ?? "—"}
        </td>

        <td className="px-3 py-4 text-slate-700">
          {orcamento.titulo}
        </td>

        <td className="px-3 py-4 text-slate-700">
          {formatCurrency(orcamento.valor)}
        </td>

        <td className="px-3 py-4">
            <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                statusStyles[orcamento.status] ??
                "bg-slate-100 text-slate-600"
            }`}
        >
            {orcamento.status === "enviado"
              ? role === "member" ? "Aguardando aprovação" : "Pendente de aprovação"
              : statusLabels[orcamento.status] ?? orcamento.status}
            </span>
        </td>

        <td className="px-3 py-4 text-slate-700">
          {formatDate(orcamento.validade_ate)}
        </td>

        <td className="px-3 py-4 text-slate-700">
          {formatDate(
            orcamento.created_at.slice(0, 10)
          )}
        </td>

        <td className="px-3 py-4">
          <div className="flex justify-end gap-2">
            {(role === "owner" || orcamento.status === "enviado") && <button
                type="button"
                onClick={() => void handleEdit(orcamento)}
                    className="rounded-lg border border-purple-200 px-3 py-2 text-xs font-medium text-purple-700 transition hover:bg-purple-50"
                >
                Editar
              </button>}

            {role === "owner" && orcamento.status === "enviado" && <button
              type="button"
              onClick={() => void handleApprove(orcamento)}
              className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-800"
            >Aprovar</button>}

            {role === "owner" && <button
              type="button"
              onClick={() => void enviarOrcamento(orcamento)}
              className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700"
            >
              Compartilhar pelo WhatsApp
            </button>}

            {role === "owner" && <button
              type="button"
              onClick={() => handleDelete(orcamento.id)}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              Excluir
            </button>}
          </div>
        </td>
      </tr>
    ))}
  </tbody>
</table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
