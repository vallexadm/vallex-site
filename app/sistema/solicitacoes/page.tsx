"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type VitrineService = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
};

type Solicitacao = {
  id: string;
  organization_id: string;
  vitrine_service_id: string | null;
  customer_id: string | null;
  orcamento_id: string | null;
  nome: string;
  telefone: string;
  email: string;
  descricao: string | null;
  endereco: string | null;
  data_preferida: string | null;
  horario_preferido: string | null;
  observacoes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  vitrine_services: VitrineService | VitrineService[] | null;
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  plan?: {
    code: string;
    name: string;
    canManageRequests: boolean;
    canFilterRequests: boolean;
    canExportCsv: boolean;
  };
  organization?: {
    id: string;
    name: string;
  };
  solicitacoes?: Solicitacao[];
};

const STATUS_LABELS: Record<string, string> = {
  nova: "Nova",
  em_analise: "Em análise",
  cliente_cadastrado: "Cliente cadastrado",
  orcamento_criado: "Orçamento criado",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

function obterServico(
  servico: Solicitacao["vitrine_services"]
): VitrineService | null {
  if (!servico) return null;

  if (Array.isArray(servico)) {
    return servico[0] ?? null;
  }

  return servico;
}

function formatarData(data: string) {
  return new Date(data).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatarDataPreferida(data: string | null) {
  if (!data) return "Não informada";

  const partes = data.split("-");

  if (partes.length !== 3) return data;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarValor(valor: number | null) {
  if (valor === null || valor === undefined) {
    return "Sob consulta";
  }

  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function linkWhatsApp(telefone: string) {
  const digitado = telefone.replace(/\D/g, "");
  const numero = digitado.length === 10 || digitado.length === 11
    ? `55${digitado}`
    : digitado;
  return `https://wa.me/${numero}`;
}

function classeStatus(status: string) {
  switch (status) {
    case "nova":
      return "border-blue-200 bg-blue-50 text-blue-800";

    case "em_analise":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "cliente_cadastrado":
      return "border-indigo-200 bg-indigo-50 text-indigo-800";

    case "orcamento_criado":
      return "border-purple-200 bg-purple-50 text-purple-800";

    case "concluida":
      return "border-green-200 bg-green-50 text-green-800";

    case "cancelada":
      return "border-red-200 bg-red-50 text-red-800";

    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export default function SolicitacoesPage() {
  const router = useRouter();

  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [mensagemStatus, setMensagemStatus] = useState("");
  const [plano, setPlano] = useState<ApiResponse["plan"] | null>(null);
  const [organizacao, setOrganizacao] = useState<ApiResponse["organization"] | null>(null);
  const [emailAcesso, setEmailAcesso] = useState("");
  const [exportandoCsv, setExportandoCsv] = useState(false);

  const podeGerenciarSolicitacoes = plano?.canManageRequests === true;
  const podeFiltrarSolicitacoes = plano?.canFilterRequests === true;
  const podeExportarCsv = plano?.canExportCsv === true;

  useEffect(() => {
    async function carregarSolicitacoes() {
      try {
        setCarregando(true);
        setErro("");

        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !data.session) {
          router.replace("/sistema/login");
          return;
        }

        const response = await fetch("/api/sistema/solicitacoes", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
          cache: "no-store",
        });

        const resultado: ApiResponse = await response.json();

        if (response.status === 403) {
          router.replace("/sistema");
          return;
        }

        if (response.status === 401) {
          router.replace("/sistema/login");
          return;
        }

        if (!response.ok) {
          throw new Error(
            resultado.message ||
              "Não foi possível carregar as solicitações."
          );
        }

        setPlano(resultado.plan ?? null);
        setOrganizacao(resultado.organization ?? null);
        setEmailAcesso(data.session.user.email ?? "");
        setSolicitacoes(resultado.solicitacoes ?? []);
      } catch (error) {
        setErro(
          error instanceof Error
            ? error.message
            : "Ocorreu um erro ao carregar as solicitações."
        );
      } finally {
        setCarregando(false);
      }
    }

    carregarSolicitacoes();
  }, [router]);

  async function exportarCsv() {
    setExportandoCsv(true);
    setMensagemStatus("");

    try {
      const { data, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !data.session) {
        router.replace("/sistema/login");
        return;
      }

      const response = await fetch(
        "/api/sistema/solicitacoes?format=csv",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const resultado: ApiResponse = await response.json();
        throw new Error(
          resultado.message || "Não foi possível exportar as solicitações."
        );
      }

      const arquivo = await response.blob();
      const url = window.URL.createObjectURL(arquivo);
      const link = document.createElement("a");
      link.href = url;
      link.download = "solicitacoes.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setMensagemStatus(
        error instanceof Error
          ? error.message
          : "Erro ao exportar as solicitações."
      );
    } finally {
      setExportandoCsv(false);
    }
  }

async function atualizarStatus(id: string, status: string) {
  setSalvandoId(id);
  setMensagemStatus("");

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      router.replace("/sistema/login");
      return;
    }

    const response = await fetch("/api/sistema/solicitacoes", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({
        id,
        status,
      }),
    });

    const resultado = await response.json();

    if (response.status === 401) {
      router.replace("/sistema/login");
      return;
    }

    if (response.status === 403) {
      router.replace("/sistema");
      return;
    }

    if (!response.ok) {
      throw new Error(
        resultado.message ||
          "Não foi possível atualizar o status."
      );
    }

    setSolicitacoes((atuais) =>
      atuais.map((solicitacao) =>
        solicitacao.id === id
          ? {
              ...solicitacao,
              status: resultado.solicitacao.status,
              updated_at: resultado.solicitacao.updated_at,
            }
          : solicitacao
      )
    );

    setMensagemStatus("Status atualizado com sucesso.");

    window.setTimeout(() => {
      setMensagemStatus("");
    }, 3000);
  } catch (error) {
    setMensagemStatus(
      error instanceof Error
        ? error.message
        : "Erro ao atualizar o status."
    );
  } finally {
    setSalvandoId(null);
  }
}
async function cadastrarCliente(id: string) {
  setSalvandoId(id);
  setMensagemStatus("");

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      router.replace("/sistema/login");
      return;
    }

    const response = await fetch(
      `/api/sistema/solicitacoes/${id}/cliente`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          id,
        }),
      }
    );

    const resultado = await response.json();

    if (response.status === 401) {
      router.replace("/sistema/login");
      return;
    }

    if (response.status === 403) {
      router.replace("/sistema");
      return;
    }

    if (!response.ok) {
      throw new Error(
        resultado.message ||
          "Não foi possível cadastrar o cliente."
      );
    }

    setSolicitacoes((atuais) =>
      atuais.map((solicitacao) =>
        solicitacao.id === id
          ? {
              ...solicitacao,
              customer_id:
                resultado.customer?.id ??
                solicitacao.customer_id,
              status:
                resultado.solicitacao?.status ??
                "cliente_cadastrado",
              updated_at:
                resultado.solicitacao?.updated_at ??
                solicitacao.updated_at,
            }
          : solicitacao
      )
    );

    setMensagemStatus(
      resultado.message ||
        "Cliente cadastrado e vinculado à solicitação com sucesso."
    );

    window.setTimeout(() => {
      setMensagemStatus("");
    }, 3000);
  } catch (error) {
    setMensagemStatus(
      error instanceof Error
        ? error.message
        : "Erro ao cadastrar o cliente."
    );
  } finally {
    setSalvandoId(null);
  }
}
async function criarOrcamento(id: string) {
  setSalvandoId(id);
  setMensagemStatus("");

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      router.replace("/sistema/login");
      return;
    }

    const response = await fetch(
      `/api/sistema/solicitacoes/${id}/orcamento`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      }
    );

    const resultado = await response.json();

    if (response.status === 401) {
      router.replace("/sistema/login");
      return;
    }

    if (response.status === 403) {
      router.replace("/sistema");
      return;
    }

    if (!response.ok) {
      throw new Error(
        resultado.message || "Não foi possível criar o orçamento."
      );
    }

    setSolicitacoes((atuais) =>
      atuais.map((solicitacao) =>
        solicitacao.id === id
          ? {
              ...solicitacao,
              orcamento_id:
                resultado.orcamento?.id ??
                resultado.orcamento_id ??
                solicitacao.orcamento_id,
              status:
                resultado.solicitacao?.status ??
                (resultado.created === false
                  ? solicitacao.status
                  : "orcamento_criado"),
              updated_at:
                resultado.solicitacao?.updated_at ??
                solicitacao.updated_at,
            }
          : solicitacao
      )
    );

    setMensagemStatus(
      resultado.message || "Orçamento criado com sucesso."
    );

    const quoteId =
      resultado.orcamento?.id ?? resultado.orcamento_id;

    if (quoteId) {
      router.push(
        `/sistema/orcamentos?editar=${encodeURIComponent(quoteId)}`
      );
    }
  } catch (error) {
    setMensagemStatus(
      error instanceof Error
        ? error.message
        : "Erro ao criar o orçamento."
    );
  } finally {
    setSalvandoId(null);
  }
}
  const solicitacoesFiltradas = useMemo(() => {
    return solicitacoes.filter((solicitacao) => {
      const termo = busca.trim().toLowerCase();
      const servico = obterServico(solicitacao.vitrine_services);

      const correspondeBusca =
        !termo ||
        solicitacao.nome.toLowerCase().includes(termo) ||
        solicitacao.telefone.toLowerCase().includes(termo) ||
        solicitacao.email.toLowerCase().includes(termo) ||
        (servico?.name ?? "").toLowerCase().includes(termo);

      const correspondeStatus =
        filtroStatus === "todos" ||
        solicitacao.status === filtroStatus;

      return correspondeBusca && correspondeStatus;
    });
  }, [solicitacoes, busca, filtroStatus]);

  const totalNovas = solicitacoes.filter(
    (solicitacao) => solicitacao.status === "nova"
  ).length;

  const totalEmAnalise = solicitacoes.filter(
    (solicitacao) => solicitacao.status === "em_analise"
  ).length;

  const totalClientesCadastrados = solicitacoes.filter(
    (solicitacao) => solicitacao.status === "cliente_cadastrado"
  ).length;

  const totalOrcamentos = solicitacoes.filter(
    (solicitacao) => solicitacao.status === "orcamento_criado"
  ).length;

  const totalConcluidas = solicitacoes.filter(
    (solicitacao) => solicitacao.status === "concluida"
  ).length;

  const totalCanceladas = solicitacoes.filter(
    (solicitacao) => solicitacao.status === "cancelada"
  ).length;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Solicitações recebidas
            </h1>

            <p className="mt-2 text-gray-600">
              Consulte os pedidos enviados pela Vitrine pública do
              ServiçoFácil.
            </p>
            {plano && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-slate-700">
                  <span>Prestador: <strong>{organizacao?.name ?? "Sua organização"}</strong></span>
                  {emailAcesso && <span>Acesso: <strong>{emailAcesso}</strong></span>}
                  <span>Plano atual: <strong>{plano.name}</strong></span>
                </div>
                {plano.code === "free" && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-slate-600">No Free, você pode publicar 1 serviço na Vitrine e consultar solicitações em modo somente leitura.</span>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/sistema/servicos" className="inline-flex rounded-lg bg-purple-700 px-4 py-2 font-semibold text-white hover:bg-purple-800">Cadastrar meu serviço</Link>
                      <Link href="/sistema/vitrine" className="inline-flex rounded-lg border border-purple-300 bg-white px-4 py-2 font-semibold text-purple-800 hover:bg-purple-50">Configurar Vitrine</Link>
                      <Link href="/sistema/planos" className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50">Conhecer planos</Link>
                    </div>
                  </div>
                )}
              </div>
            )}
            {mensagemStatus && (
  <p
    className={`mt-3 text-sm ${
      mensagemStatus.includes("Erro") ||
      mensagemStatus.includes("Não foi")
        ? "text-red-600"
        : "text-green-600"
    }`}
    role="status"
  >
    {mensagemStatus}
  </p>
)}
          </div>

          <Link
            href={plano?.code === "free" ? "/sistema/planos" : "/sistema"}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold transition hover:border-violet-400 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
          >
            <span aria-hidden="true">←</span> {plano?.code === "free" ? "Planos" : "Voltar ao painel"}
          </Link>
        </div>

        {carregando && (
          <div className="rounded-xl border bg-white p-6">
            Carregando solicitações...
          </div>
        )}

        {!carregando && erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            <p className="font-semibold">
              Não foi possível carregar os dados.
            </p>

            <p className="mt-1 text-sm">{erro}</p>
          </div>
        )}

        {!carregando && !erro && solicitacoes.length === 0 && (
          <div className="rounded-xl border bg-white p-8 text-center">
            <h2 className="text-lg font-semibold">
              Nenhuma solicitação encontrada
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Quando alguém solicitar um orçamento pela Vitrine
              pública, a solicitação aparecerá nesta página.
            </p>
          </div>
        )}

        {!carregando && !erro && solicitacoes.length > 0 && (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Total de solicitações:{" "}
              <strong className="text-gray-900">
                {solicitacoes.length}
              </strong>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-sm text-slate-500">Total</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">
                  {solicitacoes.length}
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-700">Novas</p>
                <p className="mt-1 text-2xl font-bold text-blue-800">
                  {totalNovas}
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-700">Em análise</p>
                <p className="mt-1 text-2xl font-bold text-amber-800">
                  {totalEmAnalise}
                </p>
              </div>

              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-sm text-indigo-700">
                  Clientes cadastrados
                </p>
                <p className="mt-1 text-2xl font-bold text-indigo-800">
                  {totalClientesCadastrados}
                </p>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                <p className="text-sm text-purple-700">
                  Orçamentos criados
                </p>
                <p className="mt-1 text-2xl font-bold text-purple-800">
                  {totalOrcamentos}
                </p>
              </div>

              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-700">Concluídas</p>
                <p className="mt-1 text-2xl font-bold text-green-800">
                  {totalConcluidas}
                </p>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">Canceladas</p>
                <p className="mt-1 text-2xl font-bold text-red-800">
                  {totalCanceladas}
                </p>
              </div>
            </div>

            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
              {podeFiltrarSolicitacoes ? (
                <div className="grid flex-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="busca-solicitacoes"
                      className="mb-1 block text-sm font-medium text-slate-700"
                    >
                      Buscar solicitação
                    </label>

                    <input
                      id="busca-solicitacoes"
                      type="text"
                      value={busca}
                      onChange={(event) => setBusca(event.target.value)}
                      placeholder="Nome, telefone, e-mail ou serviço..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="filtro-status"
                      className="mb-1 block text-sm font-medium text-slate-700"
                    >
                      Filtrar por status
                    </label>

                    <select
                      id="filtro-status"
                      value={filtroStatus}
                      onChange={(event) =>
                        setFiltroStatus(event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      <option value="todos">Todos os status</option>
                      <option value="nova">Nova</option>
                      <option value="em_analise">Em análise</option>
                      <option value="cliente_cadastrado">
                        Cliente cadastrado
                      </option>
                      <option value="orcamento_criado">
                        Orçamento criado
                      </option>
                      <option value="concluida">Concluída</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </div>
                </div>
              ) : (
                <p className="flex-1 rounded-xl border border-gray-200 bg-white p-4 text-sm text-slate-600">
                  Filtros de busca e status estão disponíveis nos planos pagos.
                </p>
              )}

              {podeExportarCsv && (
                <button
                  type="button"
                  onClick={exportarCsv}
                  disabled={exportandoCsv}
                  className="rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exportandoCsv ? "Preparando arquivo..." : "Exportar CSV"}
                </button>
              )}
            </div>

            {solicitacoesFiltradas.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                Nenhuma solicitação encontrada com os filtros
                informados.
              </p>
            )}

            <div className="space-y-5">
              {solicitacoesFiltradas.map((solicitacao) => {
                const servico = obterServico(
                  solicitacao.vitrine_services
                );

                return (
                  <article
                    key={solicitacao.id}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold">
                          {solicitacao.nome}
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                          Recebida em{" "}
                          {formatarData(solicitacao.created_at)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
  <label
    htmlFor={`status-${solicitacao.id}`}
    className="text-xs font-medium text-slate-500"
  >
    Status
  </label>

  {podeGerenciarSolicitacoes ? (
    <select
      id={`status-${solicitacao.id}`}
      value={solicitacao.status}
      disabled={salvandoId === solicitacao.id}
      onChange={(event) =>
        atualizarStatus(solicitacao.id, event.target.value)
      }
      className={`rounded-lg border px-3 py-2 text-sm font-semibold focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 ${classeStatus(
        solicitacao.status
      )}`}
    >
      <option value="nova">Nova</option>
      <option value="em_analise">Em análise</option>
      <option value="cliente_cadastrado">Cliente cadastrado</option>
      <option value="orcamento_criado">Orçamento criado</option>
      <option value="concluida">Concluída</option>
      <option value="cancelada">Cancelada</option>
    </select>
  ) : (
    <span
      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${classeStatus(
        solicitacao.status
      )}`}
    >
      {STATUS_LABELS[solicitacao.status] ?? solicitacao.status}
    </span>
  )}

  {salvandoId === solicitacao.id && (
    <span className="text-xs text-slate-500">
      Salvando...
    </span>
  )}

  {podeGerenciarSolicitacoes && !solicitacao.customer_id && (
  <button
    type="button"
    onClick={() => cadastrarCliente(solicitacao.id)}
    disabled={salvandoId === solicitacao.id}
    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
  >
    Cadastrar cliente
  </button>
)}

{podeGerenciarSolicitacoes && solicitacao.customer_id && !solicitacao.orcamento_id && (
  <button
    type="button"
    onClick={() => criarOrcamento(solicitacao.id)}
    disabled={salvandoId === solicitacao.id}
    className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {salvandoId === solicitacao.id
      ? "Criando orçamento..."
      : "Criar orçamento"}
  </button>
)}

{podeGerenciarSolicitacoes && solicitacao.orcamento_id && (
  <button
    type="button"
    onClick={() => router.push(`/sistema/orcamentos?editar=${encodeURIComponent(solicitacao.orcamento_id!)}`)}
    className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100"
  >
    Editar e responder orçamento
  </button>
)}

</div>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-500">
                          Serviço solicitado
                        </p>

                        <p className="mt-1 font-medium">
                          {servico?.name ?? "Serviço não identificado"}
                        </p>

                        {servico?.price !== null &&
                          servico?.price !== undefined && (
                            <p className="mt-1 text-sm text-purple-700">
                              Valor de referência:{" "}
                              {formatarValor(servico.price)}
                            </p>
                          )}
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-500">
                          Telefone
                        </p>

                        <p className="mt-1">
                          {solicitacao.telefone}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-500">
                          E-mail
                        </p>

                        <p className="mt-1">
                          {solicitacao.email || "Não informado"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-500">
                          Data preferida
                        </p>

                        <p className="mt-1">
                          {formatarDataPreferida(
                            solicitacao.data_preferida
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-500">
                          Horário preferido
                        </p>

                        <p className="mt-1">
                          {solicitacao.horario_preferido ||
                            "Não informado"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-gray-500">
                          Endereço
                        </p>

                        <p className="mt-1">
                          {solicitacao.endereco ||
                            "Não informado"}
                        </p>
                      </div>
                    </div>

                    {servico?.description && (
                      <div className="mt-5">
                        <p className="text-xs font-semibold uppercase text-gray-500">
                          Sobre o serviço
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {servico.description}
                        </p>
                      </div>
                    )}

                    {solicitacao.descricao && (
                      <div className="mt-5">
                        <p className="text-xs font-semibold uppercase text-gray-500">
                          Descrição da solicitação
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                          {solicitacao.descricao}
                        </p>
                      </div>
                    )}

                    {solicitacao.observacoes && (
                      <div className="mt-5">
                        <p className="text-xs font-semibold uppercase text-gray-500">
                          Observações
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                          {solicitacao.observacoes}
                        </p>
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap gap-3 border-t pt-4">
                      <a
                        href={linkWhatsApp(solicitacao.telefone)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Contatar pelo WhatsApp
                      </a>

                      {solicitacao.email && (
                        <a
                          href={`mailto:${solicitacao.email}`}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                        >
                          Enviar e-mail
                        </a>
                      )}

                      {solicitacao.customer_id && (
                        <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700">
                          Cliente vinculado
                        </span>
                      )}

                      {solicitacao.orcamento_id && (
                        <span className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700">
                          Orçamento vinculado
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
