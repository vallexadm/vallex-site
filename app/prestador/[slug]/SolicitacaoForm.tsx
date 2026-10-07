"use client";

import { FormEvent, useState } from "react";

type SolicitationFormProps = {
  slug: string;
  serviceId: string;
  serviceName: string;
  onClose?: () => void;
};

export default function SolicitacaoForm({
  slug,
  serviceId,
  serviceName,
  onClose,
}: SolicitationFormProps) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [descricao, setDescricao] = useState("");
  const [endereco, setEndereco] = useState("");
  const [dataPreferida, setDataPreferida] = useState("");
  const [horarioPreferido, setHorarioPreferido] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");
  const [formAberto, setFormAberto] = useState(false);

  async function enviarSolicitacao(event: FormEvent) {
    event.preventDefault();

    setErro("");
    setSucesso(false);
    setEnviando(true);

    try {
      const response = await fetch("/api/public/solicitacoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
          vitrine_service_id: serviceId,
          nome,
          telefone,
          email,
          descricao,
          endereco,
          data_preferida: dataPreferida,
          horario_preferido: horarioPreferido,
          observacoes,
        }),
      });

      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(
          resultado.message ||
            "Não foi possível enviar sua solicitação."
        );
      }

      setNome("");
      setTelefone("");
      setEmail("");
      setDescricao("");
      setEndereco("");
      setDataPreferida("");
      setHorarioPreferido("");
      setObservacoes("");

      setSucesso(true);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar sua solicitação."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
  <>
    {!formAberto ? (
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setFormAberto(true)}
          className="w-full rounded-lg bg-purple-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-800"
        >
          Solicitar orçamento
        </button>
      </div>
    ) : (
      <div className="mt-5 rounded-xl border border-purple-200 bg-purple-50 p-5">
            <div>
              <h5 className="mt-1 text-lg font-semibold text-slate-900">
                {serviceName}
              </h5>
            
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            )}
          </div>
        
        {erro && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {erro}
          </div>
        )}

        <form onSubmit={enviarSolicitacao}>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor={`nome-${serviceId}`}
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Nome *
              </label>

              <input
                id={`nome-${serviceId}`}
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                required
                maxLength={160}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                placeholder="Seu nome"
              />
            </div>

            <div>
              <label
                htmlFor={`telefone-${serviceId}`}
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Telefone *
              </label>

              <input
                id={`telefone-${serviceId}`}
                value={telefone}
                onChange={(event) =>
                  setTelefone(event.target.value)
                }
                required
                maxLength={40}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                placeholder="(62) 99999-9999"
              />
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor={`email-${serviceId}`}
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              E-mail *
            </label>

            <input
                id={`email-${serviceId}`}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={320}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                placeholder="seuemail@exemplo.com"
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Este e-mail será utilizado para enviar o orçamento,
              atualizações e informações relacionadas ao seu atendimento.
            </p>
            </div>


          <div className="mt-5">
            <label
              htmlFor={`descricao-${serviceId}`}
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              O que você precisa?
            </label>

            <textarea
              id={`descricao-${serviceId}`}
              value={descricao}
              onChange={(event) =>
                setDescricao(event.target.value)
              }
              maxLength={5000}
              rows={4}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              placeholder="Descreva brevemente o que você precisa."
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor={`endereco-${serviceId}`}
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Endereço
            </label>

            <input
              id={`endereco-${serviceId}`}
              value={endereco}
              onChange={(event) =>
                setEndereco(event.target.value)
              }
              maxLength={2000}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              placeholder="Informe se o atendimento for no local."
            />
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor={`data-${serviceId}`}
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Data preferida
              </label>

              <input
                id={`data-${serviceId}`}
                type="date"
                value={dataPreferida}
                onChange={(event) =>
                  setDataPreferida(event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              />
            </div>

            <div>
              <label
                htmlFor={`horario-${serviceId}`}
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Horário preferido
              </label>

              <input
                id={`horario-${serviceId}`}
                value={horarioPreferido}
                onChange={(event) =>
                  setHorarioPreferido(event.target.value)
                }
                maxLength={100}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                placeholder="Ex.: manhã ou 14:00"
              />
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor={`observacoes-${serviceId}`}
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Observações
            </label>

            <textarea
              id={`observacoes-${serviceId}`}
              value={observacoes}
              onChange={(event) =>
                setObservacoes(event.target.value)
              }
              maxLength={3000}
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
              placeholder="Alguma informação adicional?"
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={enviando}
              className="rounded-lg bg-purple-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando
                ? "Enviando..."
                : "Enviar solicitação"}
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={enviando}
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
)}
      {sucesso && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`sucesso-${serviceId}`}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <span className="text-2xl font-bold text-green-700">
                ✓
              </span>
            </div>

            <div className="mt-5 text-center">
              <h4
                id={`sucesso-${serviceId}`}
                className="text-2xl font-bold text-slate-900"
              >
                Solicitação enviada!
              </h4>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Sua solicitação para{" "}
                <strong className="text-slate-900">
                  {serviceName}
                </strong>{" "}
                foi recebida com sucesso.
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                O prestador entrará em contato em breve.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
              setSucesso(false);
              setFormAberto(false);
            }}
              className="mt-6 w-full rounded-lg bg-purple-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-800"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </>
  );
}