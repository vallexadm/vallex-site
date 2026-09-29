import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Soluções Digitais | VALLEX SERVIÇOFÁCIL",
  description:
    "Conheça as soluções digitais da VALLEX para organização de serviços, atendimento e processos comerciais.",
};

const solutions = [
  {
    number: "01",
    title: "ServiçoFácil",
    description:
      "Uma proposta de sistema para organizar solicitações de serviços, agendamentos, atendimentos e acompanhamento das atividades técnicas.",
    status: "Em desenvolvimento",
  },
  {
    number: "02",
    title: "Gestão de Leads e Clientes",
    description:
      "Uma solução para registrar contatos, organizar oportunidades comerciais, acompanhar negociações e manter o histórico de relacionamento.",
    status: "Em desenvolvimento",
  },
  {
    number: "03",
    title: "Aplicações Web Personalizadas",
    description:
      "Desenvolvimento de ferramentas digitais conforme as necessidades e os processos de cada negócio.",
    status: "Sob consulta",
  },
];

export default function Solucoes() {
  return (
    <>
      <Header />

      <main>
        <section className="hero">
          <div className="container hero-content">
            <span className="eyebrow">Soluções digitais VALLEX</span>

            <h1>Tecnologia para organizar e simplificar processos.</h1>

            <p>
              Desenvolvemos propostas de soluções digitais para apoiar
              atividades técnicas, atendimento ao cliente e processos
              comerciais de pessoas e empresas.
            </p>

            <div className="hero-actions">
              <Link href="/contato" className="button button-primary">
                Fale sobre seu projeto
              </Link>

              <Link href="/servicos" className="button button-outline">
                Conhecer serviços
              </Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">Nossas soluções</span>
              <h2>Ferramentas para diferentes necessidades</h2>
              <p>
                Conheça as iniciativas digitais da VALLEX. As soluções
                identificadas como em desenvolvimento ainda estão em fase
                de construção e validação.
              </p>
            </div>

            <div className="service-grid">
              {solutions.map((solution) => (
                <article className="service-card" key={solution.number}>
                  <span className="service-number">{solution.number}</span>

                  <h3>{solution.title}</h3>

                  <p>{solution.description}</p>

                  <p>
                    <strong>Status:</strong> {solution.status}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">Vamos conversar?</span>
              <h2>Tem uma necessidade específica?</h2>
              <p>
                Entre em contato para apresentar sua demanda e avaliar
                possibilidades de atendimento ou desenvolvimento de uma
                solução digital.
              </p>

              <Link href="/contato" className="button button-primary">
                Solicitar atendimento
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}