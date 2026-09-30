"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Contato = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  servico: string;
  descricao: string;
  data_preferida: string | null;
  horario_preferido: string | null;
  sugestao_futura: string | null;
  status: string;
  criado_em: string;
};
type Historico = {
  id: string;
  contato_id: string;
  tipo: "status_alterado" | "anotacao";
  status_anterior: string | null;
  status_novo: string | null;
  observacao: string | null;
  criado_por: string | null;
  criado_em: string;
};

export default function SolicitacoesPage() {
  const router = useRouter();

  const [contatos, setContatos] = useState<Contato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [mensagemStatus, setMensagemStatus] = useState("");
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [historicos, setHistoricos] = useState<Record<string, Historico[]>>({});
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);
  const [anotacoes, setAnotacoes] = useState<Record<string, string>>({});
  const [carregandoHistorico, setCarregandoHistorico] = useState<string | null>(null);
  const [salvandoAnotacao, setSalvandoAnotacao] = useState<string | null>(null);
  const [mensagensHistorico, setMensagensHistorico] = useState<Record<string, string>>({});

  useEffect(() => {
    async function carregarSolicitacoes() {
      try {
        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !data.session) {
          router.replace("/sistema/login");
          return;
        }

        const response = await fetch("/api/contatos", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
          cache: "no-store",
        });

        const resultado = await response.json();

        if (!response.ok) {
          throw new Error(
            resultado.message || "Não foi possível carregar as solicitações."
          );
        }

        setContatos(resultado.contatos ?? []);
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

  function linkWhatsApp(telefone: string) {
    const numero = telefone.replace(/\D/g, "");
    return `https://wa.me/${numero}`;
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

    const response = await fetch("/api/contatos", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({ id, status }),
    });

    const resultado = await response.json();

    if (!response.ok) {
      throw new Error(
        resultado.message || "Não foi possível atualizar o status."
      );
    }

    setContatos((atuais) =>
      atuais.map((contato) =>
        contato.id === id
          ? { ...contato, status: resultado.contato.status }
          : contato
      )
    );

    setMensagemStatus("Status atualizado com sucesso.");
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

async function carregarHistorico(contatoId: string) {
  setCarregandoHistorico(contatoId);
  setMensagensHistorico((atuais) => ({
    ...atuais,
    [contatoId]: "",
  }));

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      router.replace("/sistema/login");
      return;
    }

    const response = await fetch(
      `/api/contatos/historico?contatoId=${encodeURIComponent(contatoId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
        cache: "no-store",
      }
    );

    const resultado = await response.json();

    if (!response.ok) {
      throw new Error(
        resultado.message || "Não foi possível carregar o histórico."
      );
    }

    setHistoricos((atuais) => ({
      ...atuais,
      [contatoId]: resultado.historico ?? [],
    }));
  } catch (error) {
    setMensagensHistorico((atuais) => ({
      ...atuais,
      [contatoId]:
        error instanceof Error
          ? error.message
          : "Erro ao carregar o histórico.",
    }));
  } finally {
    setCarregandoHistorico(null);
  }
}

async function salvarAnotacao(contatoId: string) {
  const observacao = (anotacoes[contatoId] ?? "").trim();

  if (!observacao) {
    setMensagensHistorico((atuais) => ({
      ...atuais,
      [contatoId]: "Digite uma anotação antes de salvar.",
    }));
    return;
  }

  setSalvandoAnotacao(contatoId);
  setMensagensHistorico((atuais) => ({
    ...atuais,
    [contatoId]: "",
  }));

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      router.replace("/sistema/login");
      return;
    }

    const response = await fetch("/api/contatos/historico", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({
        contatoId,
        observacao,
      }),
    });

    const resultado = await response.json();

    if (!response.ok) {
      throw new Error(
        resultado.message || "Não foi possível salvar a anotação."
      );
    }

    setAnotacoes((atuais) => ({
      ...atuais,
      [contatoId]: "",
    }));

    await carregarHistorico(contatoId);

    setMensagensHistorico((atuais) => ({
      ...atuais,
      [contatoId]: "Anotação salva com sucesso.",
    }));
  } catch (error) {
    setMensagensHistorico((atuais) => ({
      ...atuais,
      [contatoId]:
        error instanceof Error
          ? error.message
          : "Erro ao salvar a anotação.",
    }));
  } finally {
    setSalvandoAnotacao(null);
  }
}
const contatosFiltrados = contatos.filter((contato) => {
  const termo = busca.trim().toLowerCase();

  const correspondeBusca =
    !termo ||
    contato.nome.toLowerCase().includes(termo) ||
    contato.telefone.toLowerCase().includes(termo) ||
    contato.servico.toLowerCase().includes(termo);

  const correspondeStatus =
    filtroStatus === "todos" || contato.status === filtroStatus;

  return correspondeBusca && correspondeStatus;
});

const totalNovas = contatos.filter(
  (contato) => contato.status === "novo"
).length;

const totalEmContato = contatos.filter(
  (contato) => contato.status === "em_contato"
).length;

const totalOrcamentos = contatos.filter(
  (contato) => contato.status === "orcamento_enviado"
).length;

const totalAgendadas = contatos.filter(
  (contato) => contato.status === "agendado"
).length;

const totalConcluidas = contatos.filter(
  (contato) => contato.status === "concluido"
).length;

const totalCanceladas = contatos.filter(
  (contato) => contato.status === "cancelado"
).length;

const totalSolicitacoes = contatos.length;
return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Solicitações recebidas
            </h1>
            {mensagemStatus && (
  <p
    role="status"
    className={`mt-3 text-sm ${
      mensagemStatus.includes("Erro") ||
      mensagemStatus.includes("Não foi")
        ? "text-red-600"
        : "text-green-600"
    }`}
  >
    {mensagemStatus}
  </p>
)}
            <p className="mt-2 text-gray-600">
              Consulte os pedidos enviados pelo formulário do site.
            </p>
          </div>

          <Link
            href="/sistema"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100"
          >
            Voltar ao painel
          </Link>
        </div>

        {carregando && (
          <div className="rounded-xl border bg-white p-6">
            Carregando solicitações...
          </div>
        )}

        {!carregando && erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            <p className="font-semibold">Não foi possível carregar os dados.</p>
            <p className="mt-1 text-sm">{erro}</p>
          </div>
        )}

        {!carregando && !erro && contatos.length === 0 && (
          <div className="rounded-xl border bg-white p-8 text-center">
            <h2 className="text-lg font-semibold">
              Nenhuma solicitação encontrada
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Quando alguém enviar o formulário de contato, a solicitação
              aparecerá nesta página.
            </p>
          </div>
        )}

        {!carregando && !erro && contatos.length > 0 && (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Total de solicitações:{" "}
              <strong className="text-gray-900">{contatos.length}</strong>
            </div>

<div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <p className="text-sm text-slate-500">Total</p>
    <p className="mt-1 text-2xl font-bold text-slate-800">
      {totalSolicitacoes}
    </p>
  </div>

  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
    <p className="text-sm text-blue-700">Novas</p>
    <p className="mt-1 text-2xl font-bold text-blue-800">{totalNovas}</p>
  </div>

  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
    <p className="text-sm text-amber-700">Em contato</p>
    <p className="mt-1 text-2xl font-bold text-amber-800">
      {totalEmContato}
    </p>
  </div>

  <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
    <p className="text-sm text-purple-700">Orçamento enviado</p>
    <p className="mt-1 text-2xl font-bold text-purple-800">
      {totalOrcamentos}
    </p>
  </div>

  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
    <p className="text-sm text-indigo-700">Agendadas</p>
    <p className="mt-1 text-2xl font-bold text-indigo-800">
      {totalAgendadas}
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

            <div className="space-y-5">
              <div className="mb-6 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
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
      placeholder="Nome, telefone ou serviço..."
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
      onChange={(event) => setFiltroStatus(event.target.value)}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
    >
      <option value="todos">Todos os status</option>
      <option value="novo">Novo</option>
      <option value="em_contato">Em contato</option>
      <option value="orcamento_enviado">Orçamento enviado</option>
      <option value="agendado">Agendado</option>
      <option value="concluido">Concluído</option>
      <option value="cancelado">Cancelado</option>
    </select>
  </div>
</div>
              {contatosFiltrados.length === 0 && (
                <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                    Nenhuma solicitação encontrada com os filtros informados.
                </p>
              )}
              {contatosFiltrados.map((contato) => (
                <article
                  key={contato.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">
                        {contato.nome}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        Recebida em {formatarData(contato.criado_em)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1">
                    <label
                    htmlFor={`status-${contato.id}`}
                    className="text-xs font-medium text-slate-500"
                  >
    Status do atendimento
  </label>

  <select
    id={`status-${contato.id}`}
    value={contato.status || "novo"}
    disabled={salvandoId === contato.id}
    onChange={(event) =>
      atualizarStatus(contato.id, event.target.value)
    }
    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
  >
    <option value="novo">Novo</option>
    <option value="em_contato">Em contato</option>
    <option value="orcamento_enviado">Orçamento enviado</option>
    <option value="agendado">Agendado</option>
    <option value="concluido">Concluído</option>
    <option value="cancelado">Cancelado</option>
  </select>

  {salvandoId === contato.id && (
  <p className="text-xs text-slate-500">Salvando...</p>
)}

                </div>
                </div>



                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-500">
                        Serviço solicitado
                      </p>
                      <p className="mt-1">{contato.servico}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-500">
                        Telefone
                      </p>
                      <p className="mt-1">{contato.telefone}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-500">
                        E-mail
                      </p>
                      <p className="mt-1">{contato.email || "Não informado"}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-500">
                        Data preferida
                      </p>
                      <p className="mt-1">
                        {formatarDataPreferida(contato.data_preferida)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-500">
                        Horário preferido
                      </p>
                      <p className="mt-1">
                        {contato.horario_preferido || "Não informado"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase text-gray-500">
                      Descrição da solicitação
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {contato.descricao}
                    </p>
                  </div>

                  {contato.sugestao_futura && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">
                        Sugestão ou observação
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                        {contato.sugestao_futura}
                      </p>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3 border-t pt-4">
                    <a
                      href={linkWhatsApp(contato.telefone)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Contatar pelo WhatsApp
                    </a>

                    {contato.email && (
                      <a
                        href={`mailto:${contato.email}`}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                      >
                        Enviar e-mail
                      </a>
                    )}
                  </div>
                  <div className="mt-5 border-t border-slate-200 pt-4">
  <button
    type="button"
    onClick={() => {
      if (historicoAberto === contato.id) {
        setHistoricoAberto(null);
      } else {
        setHistoricoAberto(contato.id);
        carregarHistorico(contato.id);
      }
    }}
    className="rounded-lg border border-purple-200 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50"
  >
    {historicoAberto === contato.id
      ? "Fechar histórico"
      : "Ver histórico e anotações"}
  </button>

  {historicoAberto === contato.id && (
    <div className="mt-4 rounded-lg bg-slate-50 p-4">
      <h3 className="text-base font-semibold text-slate-800">
        Histórico interno da solicitação
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Visível somente no painel administrativo.
      </p>

      <div className="mt-4">
        <label
          htmlFor={`anotacao-${contato.id}`}
          className="block text-sm font-medium text-slate-700"
        >
          Nova anotação interna
        </label>

        <textarea
          id={`anotacao-${contato.id}`}
          rows={3}
          maxLength={2000}
          value={anotacoes[contato.id] ?? ""}
          onChange={(event) =>
            setAnotacoes((atuais) => ({
              ...atuais,
              [contato.id]: event.target.value,
            }))
          }
          placeholder="Ex.: Cliente solicitou retorno na sexta-feira."
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
        />

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => salvarAnotacao(contato.id)}
            disabled={salvandoAnotacao === contato.id}
            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvandoAnotacao === contato.id
              ? "Salvando anotação..."
              : "Salvar anotação"}
          </button>

          <span className="text-xs text-slate-500">
            {(anotacoes[contato.id] ?? "").length}/2000 caracteres
          </span>
        </div>
      </div>

      {mensagensHistorico[contato.id] && (
        <p className="mt-3 text-sm text-slate-600" role="status">
          {mensagensHistorico[contato.id]}
        </p>
      )}

      <div className="mt-5">
        <h4 className="text-sm font-semibold text-slate-800">
          Registros anteriores
        </h4>

        {carregandoHistorico === contato.id ? (
          <p className="mt-3 text-sm text-slate-500">
            Carregando histórico...
          </p>
        ) : (historicos[contato.id] ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nenhum registro no histórico ainda.
          </p>
        ) : (
          <ol className="mt-3 space-y-3">
            {(historicos[contato.id] ?? []).map((item) => (
              <li
                key={item.id}
                className="border-l-2 border-purple-300 pl-4"
              >
                <p className="text-xs text-slate-500">
                  {formatarData(item.criado_em)}
                </p>

                {item.tipo === "status_alterado" ? (
                  <p className="mt-1 text-sm text-slate-700">
                    Status alterado:{" "}
                    <strong>{item.status_anterior || "Inicial"}</strong>
                    {" → "}
                    <strong>{item.status_novo}</strong>
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-xs font-semibold uppercase text-purple-700">
                      Anotação interna
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {item.observacao}
                    </p>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )}
</div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}