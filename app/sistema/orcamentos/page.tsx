"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type Orcamento = {
  id: string;
  customer_id: string;
  titulo: string;
  descricao: string | null;
  valor: number;
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

export default function OrcamentosPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [validadeAte, setValidadeAte] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [status, setStatus] = useState("rascunho");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setError("Sessão não encontrada. Faça login novamente.");
        return;
      }

      const [customersResponse, orcamentosResponse] =
        await Promise.all([
          fetch("/api/sistema/clientes", {
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
    } catch (error) {
      console.error("Erro ao carregar orçamentos:", error);
      setError("Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
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
        valor: Number(valor.replace(/\./g, "").replace(",", ".")),
        validade_ate: validadeAte || null,
        observacoes: observacoes.trim(),
        status,
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

    setMessage(
      isEditing
        ? "Orçamento atualizado com sucesso."
        : "Orçamento cadastrado com sucesso."
    );

    setEditingId(null);
    setCustomerId("");
    setTitulo("");
    setDescricao("");
    setValor("");
    setValidadeAte("");
    setObservacoes("");
    setStatus("rascunho");

    await loadData();
  } catch (error) {
    console.error("Erro ao salvar orçamento:", error);
    setError("Erro de comunicação ao salvar o orçamento.");
  } finally {
    setSending(false);
  }
}
        function handleEdit(orcamento: Orcamento) {
        setEditingId(orcamento.id);

        setCustomerId(orcamento.customer_id);
        setTitulo(orcamento.titulo);
        setDescricao(orcamento.descricao ?? "");
        setValor(String(orcamento.valor).replace(".", ","));
        setValidadeAte(orcamento.validade_ate ?? "");
        setObservacoes(orcamento.observacoes ?? "");
        setStatus(orcamento.status);

        setError("");
        setMessage("");

        window.scrollTo({
        top: 0,
        behavior: "smooth",
    });
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
      setValidadeAte("");
      setObservacoes("");
      setStatus("rascunho");
    }

    await loadData();
  } catch (error) {
    console.error("Erro ao excluir orçamento:", error);
    setError("Erro de comunicação ao excluir o orçamento.");
  }
}

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-purple-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div>
            <div className="text-sm font-medium tracking-[0.25em] text-purple-300">
              VALLEX
            </div>
            <div className="text-2xl font-bold">
              ServiçoFácil
            </div>
          </div>

          <Link
            href="/sistema"
            className="rounded-lg border border-purple-300 px-5 py-3 text-sm font-medium transition hover:bg-purple-900"
          >
            Voltar ao painel
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
            Registre e acompanhe propostas para seus clientes.
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
            Cadastrar orçamento
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Informe os dados básicos da proposta.
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
                  Valor *
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
              <div>
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
</div>
            </div>

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

            <button
              type="submit"
              disabled={sending}
              className="rounded-lg bg-purple-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending
                ? "Salvando..."
                : editingId
                  ? "Salvar alterações"
                  : "Cadastrar orçamento" }
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

      <th className="px-3 py-4 text-right font-medium">
        Ações
      </th>
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
            {statusLabels[orcamento.status] ?? orcamento.status}
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
            <button
                type="button"
                onClick={() => handleEdit(orcamento)}
                    className="rounded-lg border border-purple-200 px-3 py-2 text-xs font-medium text-purple-700 transition hover:bg-purple-50"
                >
                Editar
              </button>

            <button
              type="button"
              onClick={() => handleDelete(orcamento.id)}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              Excluir
            </button>
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