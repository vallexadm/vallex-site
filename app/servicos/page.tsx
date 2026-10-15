import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Serviços da VALLEX | VALLEX SERVIÇOFÁCIL",
  description:
    "Conheça o ServiçoFácil, as planilhas automatizadas e as soluções digitais sob medida da VALLEX.",
};

const vallexServices = [
  {
    number: "01",
    title: "Plataforma ServiçoFácil",
    description:
      "Uma vitrine digital para aproximar prestadores de serviços e clientes, com ferramentas para organizar o negócio.",
    examples: ["Divulgação de serviços", "Recebimento de solicitações", "Gestão da rotina do prestador"],
  },
  {
    number: "02",
    title: "Planilhas automatizadas",
    description:
      "Planilhas desenvolvidas conforme a necessidade do cliente, com recursos para simplificar tarefas e acompanhar informações.",
    examples: ["Automação de cálculos e rotinas", "Organização e acompanhamento de dados", "Prazo e valor definidos na proposta"],
  },
  {
    number: "03",
    title: "Soluções digitais sob medida",
    description:
      "Ferramentas digitais pensadas para apoiar processos de profissionais e pequenos negócios.",
    examples: ["Aplicações web", "Ferramentas para processos", "Projetos dimensionados para cada demanda"],
  },
  {
    number: "04",
    title: "Conte sua necessidade",
    description:
      "Precisa resolver algo com tecnologia ou não encontrou uma solução que combine com o seu caso? A VALLEX quer entender o que você procura.",
    examples: ["Explique seu objetivo", "Avaliamos a viabilidade", "Receba uma proposta com escopo, prazo e valor"],
  },
  {
    number: "05",
    title: "Gestão de tráfego pago",
    description:
      "Planejamento e acompanhamento de campanhas digitais para ajudar seu negócio a alcançar mais pessoas.",
    examples: ["Planos modelo para comparar", "Escopo definido conforme sua meta", "Acompanhamento dos indicadores combinados"],
    href: "/trafego-pago",
  },
];

export default function ServicosVallex() {
  return (
    <>
      <Header />
      <main>
        <section className="hero vallex-services-hero">
          <div className="container hero-content">
            <span className="eyebrow">Serviços VALLEX</span>
            <h1>Soluções digitais que começam pela sua necessidade.</h1>
            <p>
              Conectamos prestadores e clientes pelo ServiçoFácil e criamos
              ferramentas digitais, como planilhas automatizadas, conforme a
              demanda de cada negócio.
            </p>
            <div className="hero-actions">
              <Link href="/contato" className="button button-primary">Falar com a VALLEX</Link>
              <Link href="/#prestadores" className="button button-outline">Encontrar um prestador</Link>
            </div>
          </div>
        </section>

        <section className="section vallex-services-section">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">Como podemos ajudar</span>
              <h2>O que a VALLEX pode construir com você</h2>
              <p>
                A VALLEX oferece a plataforma ServiçoFácil e desenvolve soluções
                digitais sob demanda. Para contratar um profissional independente,
                busque prestadores na página inicial.
              </p>
            </div>

            <div className="service-grid vallex-service-grid">
              {vallexServices.map((service) => (
                <article className="service-card vallex-service-card" key={service.number}>
                  <span className="service-number">{service.number}</span>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <ul>
                    {service.examples.map((example) => <li key={example}>{example}</li>)}
                  </ul>
                  <Link href={"href" in service && typeof service.href === "string" ? service.href : "/contato"} className="service-card-action">{service.number === "04" ? "Apresentar minha necessidade" : service.number === "05" ? "Conhecer planos de tráfego" : "Conversar sobre esta solução"} <span aria-hidden="true">→</span></Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section vallex-service-product">
          <div className="container vallex-product-card">
            <div>
              <span className="eyebrow">Uma solução da VALLEX</span>
              <h2>Você presta serviços? Conheça o ServiçoFácil.</h2>
              <p>
                O ServiçoFácil ajuda prestadores de diferentes áreas a divulgar
                o próprio trabalho, receber solicitações e organizar a rotina do
                negócio.
              </p>
            </div>
            <Link href="/solucoes#para-prestadores" className="button button-primary">Ver soluções para prestadores</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
