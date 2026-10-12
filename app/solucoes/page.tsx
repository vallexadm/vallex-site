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

              <Link href="#planos" className="button button-outline">
                Ver planos ServiçoFácil
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

        <section className="section" id="planos">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">Planos ServiçoFácil</span>
              <h2>Organize seus atendimentos no ritmo da sua empresa</h2>
              <p>
                Comece gratuitamente e evolua quando precisar de mais pessoas
                na equipe ou de ferramentas para acompanhar o fluxo de
                atendimento. Todos os planos incluem acesso ao painel; os
                recursos de análise aumentam conforme o plano.
              </p>
            </div>

            <div className="service-grid plans-grid">
              <article className="service-card plan-card">
                <span className="service-number">FREE</span>
                <h3>R$ 0,00 <small>/ mês</small></h3>
                <p>Para conhecer a plataforma e começar a organizar a rotina.</p>
                <ul>
                  <li>1 usuário na equipe</li>
                  <li>Painel do fluxo em modo de visualização</li>
                  <li>Acesso inicial aos recursos da plataforma</li>
                </ul>
                <Link href="/sistema/login" className="button button-outline">
                  Criar conta grátis
                </Link>
              </article>

              <article className="service-card plan-card">
                <span className="service-number">BASIC</span>
                <h3>R$ 49,70 <small>/ mês</small></h3>
                <p>Para pequenos negócios que precisam acompanhar melhor os atendimentos.</p>
                <ul>
                  <li>Até 3 usuários na equipe</li>
                  <li>Painel do fluxo com filtros</li>
                  <li>Recursos do plano Free</li>
                </ul>
                <Link href="/sistema/login" className="button button-primary">
                  Acessar para contratar
                </Link>
              </article>

              <article className="service-card plan-card">
                <span className="service-number">PROFESSIONAL</span>
                <h3>R$ 79,00 <small>/ mês</small></h3>
                <p>Para equipes em crescimento que precisam analisar e compartilhar resultados.</p>
                <ul>
                  <li>Até 10 usuários na equipe</li>
                  <li>Painel com filtros e exportação para planilha</li>
                  <li>Recursos dos planos anteriores</li>
                </ul>
                <Link href="/sistema/login" className="button button-primary">
                  Acessar para contratar
                </Link>
              </article>
            </div>

            <p className="plans-note">
              A contratação dos planos Basic e Professional é feita dentro da
              plataforma, após entrar ou criar uma conta. O plano Enterprise
              não está disponível para contratação neste momento.
            </p>
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
