import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactForm from "@/components/ContactForm";

export const metadata = {
  title: "Contato | VALLEX SERVIÇOFÁCIL",
  description:
    "Entre em contato com a VALLEX para solicitar orçamento, agendar atendimento técnico ou apresentar uma ideia.",
};

export default function Contato() {
  return (
    <>
      <Header />

      <main>
        <section className="hero">
          <div className="container hero-content">
            <span className="eyebrow">Fale com a VALLEX</span>

            <h1>Como podemos ajudar você?</h1>

            <p>
              Solicite um orçamento, consulte a disponibilidade para
              atendimento técnico ou compartilhe uma ideia com a nossa equipe.
            </p>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">Atendimento online</span>
              <h2>Entre em contato</h2>

              <p>
                A VALLEX atende solicitações relacionadas a informática,
                manutenção de computadores, redes e serviços elétricos.
              </p>

              <p>
                Você também pode apresentar sugestões ou ideias para futuras
                soluções digitais.
              </p>
            </div>

            <div className="service-grid">
              <article className="service-card">
                <span className="service-number">01</span>
                <h3>E-mail comercial</h3>
                <p>Envie sua solicitação ou descreva sua necessidade.</p>
                <a href="mailto:vallexbusiness@gmail.com">
                  vallexbusiness@gmail.com
                </a>
              </article>

              <article className="service-card">
                <span className="service-number">02</span>
                <h3>WhatsApp</h3>
                <p>Entre em contato para conversar sobre seu atendimento.</p>
                <a
                  href="https://wa.me/5562985408497"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Conversar pelo WhatsApp
                </a>
              </article>

              <article className="service-card">
                <span className="service-number">03</span>
                <h3>Solicitação de orçamento</h3>
                <p>
                  Registre sua necessidade pelo formulário. A equipe VALLEX
                  analisará as informações e retornará para você.
                </p>
              </article>
            </div>
          </div>
        </section>

        <ContactForm />
      </main>

      <Footer />
    </>
  );
}