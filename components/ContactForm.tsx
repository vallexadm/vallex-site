"use client";

import { FormEvent, useState } from "react";

export default function ContactForm() {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSending(true);
    setMessage("");
    setSuccess(false);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      nome: String(formData.get("nome") ?? ""),
      telefone: String(formData.get("telefone") ?? ""),
      email: String(formData.get("email") ?? ""),
      servico: String(formData.get("servico") ?? ""),
      descricao: String(formData.get("descricao") ?? ""),
      data_preferida: String(formData.get("data_preferida") ?? ""),
      horario_preferido: String(formData.get("horario_preferido") ?? ""),
      sugestao_futura: String(formData.get("sugestao_futura") ?? ""),
    };

    try {
      const response = await fetch("/api/contatos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setMessage(
          result.message || "Não foi possível enviar sua solicitação."
        );
        return;
      }

      setSuccess(true);
      setMessage("Solicitação enviada! A VALLEX entrará em contato.");
      form.reset();
    } catch {
      setMessage(
        "Não foi possível conectar ao servidor. Tente novamente em instantes."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="section">
      <div className="container">
        <div className="section-heading">
          <span className="eyebrow">Solicitação online</span>
          <h2>Conte para nós o que você precisa</h2>
          <p>
            Preencha os dados abaixo para solicitar um orçamento, atendimento
            técnico ou compartilhar uma ideia para futuras soluções.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mx-auto grid max-w-3xl gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="nome"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Nome completo *
              </label>
              <input
                id="nome"
                name="nome"
                type="text"
                required
                maxLength={120}
                autoComplete="name"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                placeholder="Seu nome"
              />
            </div>

            <div>
              <label
                htmlFor="telefone"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Telefone / WhatsApp *
              </label>
              <input
                id="telefone"
                name="telefone"
                type="tel"
                required
                maxLength={30}
                autoComplete="tel"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                placeholder="(62) 99999-9999"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              maxLength={150}
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
              placeholder="voce@exemplo.com"
            />
          </div>

          <div>
            <label
              htmlFor="servico"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Tipo de solicitação *
            </label>
            <select
              id="servico"
              name="servico"
              required
              defaultValue=""
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            >
              <option value="" disabled>
                Selecione uma opção
              </option>
              <option value="Manutenção de computadores">
                Manutenção de computadores
              </option>
              <option value="Informática e suporte técnico">
                Informática e suporte técnico
              </option>
              <option value="Redes e conectividade">
                Redes e conectividade
              </option>
              <option value="Serviços elétricos">Serviços elétricos</option>
              <option value="Orçamento ou visita técnica">
                Orçamento ou visita técnica
              </option>
              <option value="Sugestão ou ideia para futuras soluções">
                Sugestão ou ideia para futuras soluções
              </option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="descricao"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Descreva sua necessidade *
            </label>
            <textarea
              id="descricao"
              name="descricao"
              required
              maxLength={3000}
              rows={5}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
              placeholder="Explique brevemente o serviço ou atendimento que você precisa."
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="data_preferida"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Data preferida para atendimento
              </label>
              <input
                id="data_preferida"
                name="data_preferida"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="horario_preferido"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Horário ou período preferido
              </label>
              <input
                id="horario_preferido"
                name="horario_preferido"
                type="text"
                maxLength={50}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
                placeholder="Ex.: manhã ou após 14h"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="sugestao_futura"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Sugestão ou ideia para futuras soluções (opcional)
            </label>
            <textarea
              id="sugestao_futura"
              name="sugestao_futura"
              maxLength={2000}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900"
              placeholder="Tem alguma ideia ou necessidade que gostaria de compartilhar?"
            />
          </div>

          <p className="text-sm leading-6 text-slate-600">
            Os dados informados serão utilizados pela VALLEX para analisar e
            responder à sua solicitação. Evite inserir senhas ou informações
            pessoais desnecessárias.
          </p>

          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-purple-800 px-6 py-3 font-semibold text-white transition hover:bg-purple-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Enviando..." : "Enviar solicitação"}
          </button>

          {message && (
            <p
              role="status"
              aria-live="polite"
              className={`text-sm font-medium ${
                success ? "text-green-700" : "text-red-700"
              }`}
            >
              {message}
            </p>
          )}

          <p className="text-xs text-slate-500">
            * Campos obrigatórios.
          </p>
        </form>
      </div>
    </section>
  );
}