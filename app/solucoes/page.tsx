import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { providerPlanCopy } from "@/lib/provider-plan-copy";

export const metadata = {
  title: "Soluções para prestadores | VALLEX SERVIÇOFÁCIL",
  description:
    "Divulgue seus serviços, receba solicitações e organize clientes, agenda e finanças com o ServiçoFácil da VALLEX.",
};

const providerBenefits = [
  {
    number: "01",
    title: "Uma vitrine para o seu trabalho",
    description:
      "Apresente seu negócio, os serviços que realiza, sua região e as formas de atendimento: presencial, em domicílio ou online.",
  },
  {
    number: "02",
    title: "Solicitações registradas",
    description:
      "Quando um cliente encontra sua Vitrine e pede um orçamento, a solicitação fica organizada no painel para você acompanhar.",
  },
  {
    number: "03",
    title: "Você combina o atendimento",
    description:
      "Defina diretamente com o cliente o local, o dia, o horário e as condições do serviço. A plataforma registra a intermediação e ajuda você a acompanhar o processo.",
  },
  {
    number: "04",
    title: "Mais visão do negócio",
    description:
      "Organize clientes, agenda, orçamentos e movimentações financeiras para entender melhor seus recebimentos, custos e resultados.",
  },
];

const plans = [
  {
    code: "FREE",
    name: providerPlanCopy.free.title,
    description: providerPlanCopy.free.description,
    price: "R$ 0",
    period: "/ mês",
    users: "1 usuário na equipe",
    features: [...providerPlanCopy.free.features],
    action: "Criar conta e testar",
    featured: false,
  },
  {
    code: "BASIC",
    name: providerPlanCopy.basic.title,
    description: providerPlanCopy.basic.description,
    price: "R$ 49,70",
    period: "/ mês",
    users: "Até 3 usuários na equipe",
    features: [...providerPlanCopy.basic.features],
    action: "Começar teste de 30 dias",
    featured: false,
  },
  {
    code: "PROFESSIONAL",
    name: providerPlanCopy.professional.title,
    description: providerPlanCopy.professional.description,
    price: "R$ 79,00",
    period: "/ mês",
    users: "Até 10 usuários na equipe",
    features: [...providerPlanCopy.professional.features],
    action: "Conhecer o Professional",
    featured: false,
  },
];

export default function Solucoes() {
  return (
    <>
      <Header />

      <main>
        <section className="hero solutions-provider-hero" id="para-prestadores">
          <div className="container hero-content">
            <span className="eyebrow">Soluções VALLEX para prestadores</span>
            <h1>Seu serviço merece ser encontrado e seu negócio, bem acompanhado.</h1>
            <p>
              A VALLEX conecta clientes a profissionais de diferentes áreas.
              Com o ServiçoFácil, você divulga seu trabalho, acompanha os
              contatos recebidos e organiza a rotina do seu negócio em um só lugar.
            </p>
            <div className="hero-actions">
              <Link href="/sistema/login" className="button button-primary">
                Quero me cadastrar
              </Link>
              <Link href="#planos" className="button button-outline">
                Comparar planos
              </Link>
            </div>
            <p className="solutions-hero-note">
              Para profissionais autônomos e negócios locais: de barbearias e
              assistência técnica a consultorias e serviços especializados.
            </p>
          </div>
        </section>

        <section className="section solutions-difference">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">O que torna a VALLEX diferente</span>
              <h2>Uma ponte entre a descoberta e a gestão do atendimento</h2>
              <p>
                A Vitrine ajuda o cliente a conhecer seu trabalho. Quando ele
                envia uma solicitação, você recebe o contato e decide como
                conduzir o atendimento — no escritório, no estabelecimento,
                em domicílio ou online.
              </p>
            </div>

            <div className="service-grid solutions-benefit-grid">
              {providerBenefits.map((benefit) => (
                <article className="service-card about-capability-card" key={benefit.number}>
                  <span className="service-number">{benefit.number}</span>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section solutions-flow">
          <div className="container solutions-flow-content">
            <div>
              <span className="eyebrow">Como funciona</span>
              <h2>Você mantém o controle de cada atendimento</h2>
              <p>
                A VALLEX registra a conexão. O prestador e o cliente combinam
                os detalhes do serviço diretamente, com liberdade para definir
                a melhor forma de trabalhar.
              </p>
            </div>
            <ol className="solutions-steps">
              <li><span>1</span><div><strong>Monte sua Vitrine</strong><p>Informe seus serviços, sua região e como atende.</p></div></li>
              <li><span>2</span><div><strong>Seja encontrado</strong><p>O cliente pesquisa por serviço e localidade e conhece sua apresentação.</p></div></li>
              <li><span>3</span><div><strong>Receba e combine</strong><p>A solicitação fica registrada; você conversa com o cliente e agenda o atendimento.</p></div></li>
              <li><span>4</span><div><strong>Acompanhe os números</strong><p>Organize recebimentos e gastos para enxergar melhor os resultados do negócio.</p></div></li>
            </ol>
          </div>
        </section>

        <section className="section" id="planos">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">Planos do ServiçoFácil</span>
              <h2>Escolha o nível de gestão que faz sentido para você</h2>
              <p>
                Comece acompanhando os pedidos, organize a operação no Basic e
                amplie o acompanhamento da equipe com o Professional.
              </p>
            </div>

            <div className="service-grid plans-grid">
              {plans.map((plan) => (
                <article className={`service-card plan-card${plan.featured ? " plan-card-featured" : ""}`} key={plan.code}>
                  <span className="service-number">{plan.code}</span>
                  <h3 className="plan-name">{plan.name}</h3>
                  <p className="plan-description mt-2">{plan.description}</p>
                  <p className="plan-price">{plan.price}<small> {plan.period}</small></p>
                  {plan.users && <p className="plan-users">{plan.users}</p>}
                  <ul className="plan-feature-list">
                    {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                  <Link href="/sistema/login" className={`button ${plan.featured ? "button-primary" : "button-outline"}`}>
                    {plan.action}
                  </Link>
                </article>
              ))}
            </div>
            <p className="plans-note">
              Novos cadastros começam com 30 dias de teste do Basic. Sem uma
              assinatura confirmada ao fim do teste, o acesso passa para o
              Free. A contratação dos planos pagos é confirmada pelo Asaas.
            </p>
          </div>
        </section>

        <section className="section solutions-final-cta">
          <div className="container solutions-final-card">
            <div>
              <span className="eyebrow">Divulgue seu negócio</span>
              <h2>Conheça também a gestão de tráfego pago.</h2>
              <p>Veja os planos modelo da VALLEX e conte o que você quer alcançar com suas campanhas.</p>
            </div>
            <Link href="/trafego-pago" className="button button-primary">Conhecer planos de tráfego</Link>
          </div>
        </section>

        <section className="section solutions-final-cta">
          <div className="container solutions-final-card">
            <div>
              <span className="eyebrow">Seu próximo passo</span>
              <h2>Comece apresentando o seu trabalho.</h2>
              <p>
                Crie seu acesso, configure os serviços e deixe sua Vitrine pronta
                para ser encontrada por clientes.
              </p>
            </div>
            <Link href="/sistema/login" className="button button-primary">
              Quero divulgar meus serviços
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
