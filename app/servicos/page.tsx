import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Serviços da VALLEX | VALLEX SERVIÇOFÁCIL",
  description:
    "Conheça as frentes de atuação da VALLEX em informática, serviços elétricos, redes e soluções digitais.",
};

const vallexServices = [
  {
    number: "01",
    title: "Informática e suporte",
    description:
      "Manutenção, instalação, configuração e suporte técnico para computadores, equipamentos e sistemas.",
    examples: ["Manutenção preventiva e corretiva", "Instalação e configuração", "Orientação para uso de equipamentos"],
  },
  {
    number: "02",
    title: "Serviços elétricos",
    description:
      "Soluções e serviços elétricos planejados conforme a necessidade de cada solicitação.",
    examples: ["Instalações e ajustes", "Avaliação da necessidade", "Atendimento sob consulta"],
  },
  {
    number: "03",
    title: "Redes e conectividade",
    description:
      "Configuração de redes, Wi-Fi e equipamentos de conectividade para casas e pequenos negócios.",
    examples: ["Configuração de Wi-Fi", "Organização de rede local", "Suporte a equipamentos conectados"],
  },
  {
    number: "04",
    title: "Soluções digitais",
    description:
      "Desenvolvimento de aplicações web e ferramentas digitais para apoiar processos e atividades.",
    examples: ["Aplicações web", "Ferramentas para processos", "Projetos digitais sob consulta"],
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
            <h1>Tecnologia e soluções práticas para o dia a dia.</h1>
            <p>
              A VALLEX atua em tecnologia, suporte e serviços para pessoas e
              negócios. Conheça nossas frentes de trabalho e fale com a equipe
              para apresentar sua necessidade.
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
              <h2>Serviços oferecidos pela equipe VALLEX</h2>
              <p>
                Esta página apresenta a atuação da própria VALLEX. Para buscar
                profissionais independentes — como advogados, barbeiros ou
                técnicos — use a busca de prestadores na página inicial.
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
                  <Link href="/contato" className="service-card-action">Consultar disponibilidade <span aria-hidden="true">→</span></Link>
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
