import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Sobre | VALLEX SERVIÇOFÁCIL",
  description:
    "Conheça a VALLEX e sua proposta de oferecer soluções práticas em tecnologia e serviços técnicos.",
};

export default function Sobre() {
  return (
    <>
      <Header />

      <main>
        <section className="hero">
          <div className="container hero-content">
            <span className="eyebrow">Conheça a VALLEX</span>

            <h1>Tecnologia e soluções ao seu alcance.</h1>

            <p>
              A VALLEX reúne serviços técnicos e soluções digitais para
              facilitar a rotina de pessoas e empresas, com praticidade,
              organização e atenção às necessidades de cada projeto.
            </p>

            <div className="hero-actions">
              <Link href="/servicos" className="button button-primary">
                Conhecer serviços
              </Link>

              <Link href="/contato" className="button button-outline">
                Fale conosco
              </Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">Quem somos</span>
              <h2>Uma proposta integrada de serviços e tecnologia</h2>

              <p>
                A VALLEX | SERVIÇOFÁCIL tem como proposta aproximar pessoas
                e empresas de soluções em informática, elétrica, redes e
                desenvolvimento digital.
              </p>

              <p>
                Nosso objetivo é compreender cada necessidade e orientar
                a busca por soluções adequadas, com comunicação clara e
                foco na praticidade.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">Nossa atuação</span>
              <h2>Como podemos ajudar</h2>
              <p>
                Atuamos em diferentes áreas para atender demandas técnicas
                e digitais de pessoas e empresas.
              </p>
            </div>

            <div className="service-grid">
              <article className="service-card">
                <span className="service-number">01</span>
                <h3>Informática e suporte</h3>
                <p>
                  Manutenção, instalação, configuração e suporte técnico
                  para equipamentos e sistemas.
                </p>
              </article>

              <article className="service-card">
                <span className="service-number">02</span>
                <h3>Serviços elétricos</h3>
                <p>
                  Soluções e serviços elétricos conforme as necessidades
                  de cada solicitação.
                </p>
              </article>

              <article className="service-card">
                <span className="service-number">03</span>
                <h3>Redes e conectividade</h3>
                <p>
                  Configuração de redes, Wi-Fi e equipamentos de
                  conectividade.
                </p>
              </article>

              <article className="service-card">
                <span className="service-number">04</span>
                <h3>Soluções digitais</h3>
                <p>
                  Desenvolvimento de aplicações web e ferramentas digitais
                  para apoiar processos e atividades.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">Nosso compromisso</span>
              <h2>Clareza, organização e praticidade</h2>
              <p>
                Buscamos oferecer uma experiência simples desde o primeiro
                contato até o encaminhamento da solução, mantendo uma
                comunicação objetiva sobre as necessidades e etapas do
                atendimento.
              </p>

              <Link href="/contato" className="button button-primary">
                Entre em contato
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}