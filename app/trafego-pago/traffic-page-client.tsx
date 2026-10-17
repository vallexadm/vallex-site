"use client";

import { type FormEvent, useEffect, useState } from "react";

type TrafficPlan = { code: string; name: string; tagline: string; price_label: string; description: string; features: string[]; sort_order: number };
const defaults: TrafficPlan[] = [
  { code: "local", name: "Presença local", tagline: "Para começar a aparecer para clientes da sua região.", price_label: "Sob proposta", description: "Estrutura inicial de campanha para divulgar seu negócio local.", features: ["Diagnóstico inicial", "Configuração de campanha em um canal", "Acompanhamento e resumo dos resultados"], sort_order: 1 },
  { code: "crescimento", name: "Crescimento", tagline: "Para ampliar a divulgação e acompanhar a evolução.", price_label: "Sob proposta", description: "Gestão contínua de campanhas com otimizações periódicas.", features: ["Planejamento de campanha", "Acompanhamento e otimização periódicos", "Relatório de desempenho"], sort_order: 2 },
  { code: "estrategico", name: "Estratégia completa", tagline: "Para negócios que precisam de uma gestão mais próxima.", price_label: "Sob proposta", description: "Estratégia de divulgação dimensionada conforme os objetivos do negócio.", features: ["Planejamento personalizado", "Gestão de campanhas conforme escopo", "Análise e apresentação dos resultados"], sort_order: 3 },
];

const emptyForm = { name: "", phone: "", email: "", audience: "visitante", organizationName: "", planCode: "", needDescription: "", consent: false, website: "" };

export default function TrafficPageClient() {
  const [plans, setPlans] = useState(defaults);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/trafego/planos", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => { if (active && result.ok && Array.isArray(result.plans)) setPlans(result.plans); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  function selectPlan(code: string) {
    setForm((current) => ({ ...current, planCode: code }));
    document.getElementById("pedido-trafego")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setMessage(""); setError("");
    const params = new URLSearchParams(window.location.search);
    const attribution = Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map((key) => [key, params.get(key) ?? ""]));
    try {
      const response = await fetch("/api/trafego/solicitacoes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...attribution, landingPath: window.location.pathname + window.location.search }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "Não foi possível enviar sua solicitação.");
      setMessage(result.message); setForm(emptyForm);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível enviar sua solicitação.");
    } finally { setLoading(false); }
  }

  return <main className="traffic-page">
    <section className="hero traffic-hero"><div className="container hero-content">
      <span className="eyebrow">Divulgação com estratégia</span>
      <h1>Mais pessoas certas conhecendo o seu negócio.</h1>
      <p>A VALLEX ajuda visitantes e prestadores a planejar campanhas de tráfego pago com objetivos, escopo e acompanhamento definidos para cada negócio.</p>
      <div className="hero-actions"><a className="button button-primary" href="#planos-trafego">Conhecer os planos</a><a className="button button-outline" href="#pedido-trafego">Conversar com a VALLEX</a></div>
    </div></section>

    <section className="section traffic-how"><div className="container">
      <div className="section-heading"><span className="eyebrow">Como funciona</span><h2>Uma proposta clara antes de começar</h2><p>Entendemos sua meta, avaliamos o cenário e combinamos o trabalho e os indicadores que serão acompanhados.</p></div>
      <div className="traffic-steps"><article><span>01</span><h3>Conte seu objetivo</h3><p>Explique o que você oferece e quem quer alcançar.</p></article><article><span>02</span><h3>Definimos o escopo</h3><p>Escolhemos um plano modelo ou montamos uma proposta adequada.</p></article><article><span>03</span><h3>Acompanhe a campanha</h3><p>Registramos as ações e os resultados acordados.</p></article></div>
    </div></section>

    <section className="section traffic-plans" id="planos-trafego"><div className="container">
      <div className="section-heading"><span className="eyebrow">Planos modelo</span><h2>Escolha um ponto de partida</h2><p>Os planos ajudam a comparar formatos. A proposta final considera seu objetivo, o escopo e o investimento em anúncios.</p></div>
      <div className="service-grid traffic-plan-grid">{plans.map((plan) => <article className="service-card traffic-plan-card" key={plan.code}>
        <span className="service-number">0{plan.sort_order}</span><h3>{plan.name}</h3><p className="traffic-plan-tagline">{plan.tagline}</p><p>{plan.description}</p><strong className="traffic-price">{plan.price_label}</strong>
        <ul>{(plan.features ?? []).map((feature) => <li key={feature}>{feature}</li>)}</ul>
        <button className="button traffic-plan-cta" type="button" onClick={() => selectPlan(plan.code)}>Solicitar proposta</button>
      </article>)}</div>
      {plans.length === 0 && <p className="traffic-budget-note">Os planos estão sendo atualizados. Fale com a VALLEX para conversar sobre sua campanha.</p>}
      <p className="traffic-budget-note">O valor da gestão e o investimento em anúncios são informados separadamente. O orçamento de mídia é pago pelo cliente diretamente à plataforma de anúncios.</p>
    </div></section>

    <section className="section traffic-form-section" id="pedido-trafego"><div className="container traffic-form-layout">
      <div><span className="eyebrow">Vamos conversar</span><h2>Qual resultado você quer alcançar?</h2><p>Visitante ou prestador da VALLEX, conte um pouco do seu negócio. A solicitação ficará registrada para a equipe acompanhar sua negociação.</p></div>
      <form className="traffic-lead-form" onSubmit={submit}>
        <div className="traffic-form-grid">
          <label>Seu nome<input required maxLength={120} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>WhatsApp ou telefone<input required maxLength={30} autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label>E-mail (opcional)<input type="email" maxLength={160} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Você é<select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}><option value="visitante">Visitante</option><option value="cliente">Cliente</option><option value="prestador">Prestador da VALLEX</option></select></label>
          {form.audience === "prestador" && <label className="traffic-full">Nome do negócio ou Vitrine<input maxLength={160} value={form.organizationName} onChange={(event) => setForm({ ...form, organizationName: event.target.value })} /></label>}
          <label className="traffic-full">Plano que chamou sua atenção<select value={form.planCode} onChange={(event) => setForm({ ...form, planCode: event.target.value })}><option value="">Ainda não sei</option>{plans.map((plan) => <option value={plan.code} key={plan.code}>{plan.name}</option>)}</select></label>
          <label className="traffic-full">O que você gostaria de divulgar ou melhorar?<textarea required minLength={10} maxLength={3000} rows={5} value={form.needDescription} onChange={(event) => setForm({ ...form, needDescription: event.target.value })} /></label>
          <label className="traffic-honeypot" aria-hidden="true">Não preencha<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label>
          <label className="traffic-consent traffic-full"><input type="checkbox" required checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /><span>Autorizo a VALLEX a usar estes dados para responder a esta solicitação, conforme a <a href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a>.</span></label>
        </div>
        {message && <p className="traffic-success" role="status">{message}</p>}{error && <p className="traffic-error" role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={loading}>{loading ? "Enviando…" : "Solicitar uma proposta"}</button>
      </form>
    </div></section>
  </main>;
}
