import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Image from "next/image";

export const metadata = {
  title: "Sobre | VALLEX SERVIÇOFÁCIL",
  description:
    "Conheça a VALLEX, que conecta clientes a prestadores e oferece ferramentas para organizar atendimentos e negócios.",
};

export default function Sobre() {
  return (
    <>
      <Header />

      <main>
        <section className="hero">
          <div className="container hero-content">
            <span className="eyebrow">Conheça a VALLEX</span>

            <h1>Serviços bem conectados. Negócios mais organizados.</h1>

            <p>
              A VALLEX aproxima clientes de prestadores de diferentes áreas.
              Com o ServiçoFácil, cada profissional pode divulgar seu trabalho
              e organizar solicitações, propostas, agenda e finanças.
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
              <h2>Intermediação para o cliente, gestão para o prestador</h2>

              <p>
                A VALLEX ajuda o cliente a encontrar profissionais e iniciar
                uma solicitação de serviço. Esse contato fica registrado para
                que o prestador possa combinar o atendimento diretamente com
                o cliente.
              </p>

              <p>
                Para o prestador, o ServiçoFácil reúne recursos para apresentar
                o negócio, acompanhar solicitações, preparar orçamentos,
                organizar a agenda e controlar os resultados financeiros.
              </p>
            </div>
          </div>
        </section>

        <section className="section" id="equipe">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">Equipe oficial</span>
              <h2>Quem está à frente da VALLEX</h2>
              <p>
                Tecnologia, desenvolvimento de projetos e marketing digital
                conduzidos pela equipe oficial da VALLEX.
              </p>
            </div>

            <div className="service-grid team-grid">
              <article className="service-card team-profile-card">
                <div className="team-profile-photo">
                  <Image
                    src="/equipe/valquimar-santos.jpg"
                    alt="Valquimar Santos, fundador da VALLEX"
                    width={1078}
                    height={1440}
                    sizes="(max-width: 900px) 100vw, 50vw"
                    className="team-profile-photo-image team-photo-valquimar"
                  />
                </div>
                <div className="team-profile-content">
                  <span className="service-number">Fundador</span>
                  <h3>Valquimar Santos</h3>
                  <p><strong>Fundador e Diretor Executivo de Produto e Tecnologia</strong></p>
                  <p>
                    Acadêmico de Engenharia de Software na Universidade Federal
                    de Goiás (UFG). Lidera a visão da VALLEX e está à frente da
                    construção do ServiçoFácil, da concepção do produto à
                    implementação da plataforma e de seus processos.
                  </p>
                </div>
              </article>

              <article className="service-card team-profile-card">
                <div className="team-profile-photo">
                  <Image
                    src="/equipe/alexandre-jr.png"
                    alt="Alexandre Jr., integrante da equipe oficial da VALLEX"
                    width={688}
                    height={857}
                    sizes="(max-width: 900px) 100vw, 50vw"
                    className="team-profile-photo-image team-photo-alexandre"
                  />
                </div>
                <div className="team-profile-content">
                  <span className="service-number">Equipe oficial</span>
                  <h3>Alexandre Jr.</h3>
                  <p><strong>Marketing digital e presença online</strong></p>
                  <p>
                    Atua em estratégias de marketing digital, com experiência
                    em SEO, SEM, análise de mercado, criação de conteúdo e
                    acompanhamento de campanhas.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">Nossa atuação</span>
              <h2>Como a VALLEX conecta e organiza serviços</h2>
              <p>
                Da descoberta do prestador ao acompanhamento do negócio, a
                plataforma apoia as etapas principais do atendimento.
              </p>
            </div>

            <div className="service-grid">
              <article className="service-card about-capability-card">
                <span className="service-number">01</span>
                <h3>Intermediação de serviços</h3>
                <p>
                  Clientes encontram prestadores por área, conhecem os
                  serviços disponíveis e enviam solicitações pela plataforma.
                </p>
              </article>

              <article className="service-card about-capability-card">
                <span className="service-number">02</span>
                <h3>Vitrine e divulgação</h3>
                <p>
                  Cada prestador pode apresentar seu negócio e seus serviços
                  em uma página pública. A VALLEX também planeja ações de
                  divulgação para ampliar o alcance dos profissionais.
                </p>
              </article>

              <article className="service-card about-capability-card">
                <span className="service-number">03</span>
                <h3>Atendimento organizado</h3>
                <p>
                  O prestador acompanha solicitações, prepara orçamentos para
                  aprovação do proprietário e organiza agenda e equipe.
                </p>
              </article>

              <article className="service-card about-capability-card">
                <span className="service-number">04</span>
                <h3>Gestão financeira</h3>
                <p>
                  Registre serviços, recebimentos parcelados, custos, despesas
                  e contas a pagar. Acompanhe indicadores e gere relatórios.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section impact-section" id="impacto">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">Impacto e compromisso com o futuro</span>
              <h2>Tecnologia que fortalece negócios e valoriza recursos</h2>
              <p>
                A VALLEX está construindo uma plataforma para dar visibilidade
                a prestadores e apoiar a organização de pequenos negócios. Essa
                atuação se conecta a alguns Objetivos de Desenvolvimento
                Sustentável da ONU e a um compromisso contínuo com escolhas
                mais conscientes.
              </p>
            </div>

            <div className="impact-grid">
              <article className="impact-card impact-ods-eight">
                <div className="impact-art" aria-hidden="true">
                  <svg viewBox="0 0 96 96" fill="none">
                    <circle cx="48" cy="48" r="43" />
                    <path d="M29 63V46h13v17m-6-17v-9h14v26m0-13h17v13" />
                    <path d="M25 68h47M34 31l10-8 10 6 13-12" />
                    <path d="M59 17h8v8" />
                  </svg>
                </div>
                <span className="impact-ods-label">ODS 8</span>
                <h3>Trabalho decente e crescimento econômico</h3>
                <p>
                  A vitrine e as ferramentas de gestão ajudam profissionais a
                  apresentar seus serviços e a organizar o próprio negócio.
                </p>
                <span className="impact-connection">Contribuição alinhada ao objetivo</span>
              </article>

              <article className="impact-card impact-ods-nine">
                <div className="impact-art" aria-hidden="true">
                  <svg viewBox="0 0 96 96" fill="none">
                    <circle cx="48" cy="48" r="43" />
                    <path d="M27 29h42v38H27zM35 39h10m-10 9h26m-26 9h16" />
                    <path d="M48 29v-8m14 8 7-7M69 48h8M48 67v8m-21-8-7 7M27 48h-8" />
                    <circle cx="62" cy="57" r="3" />
                  </svg>
                </div>
                <span className="impact-ods-label">ODS 9</span>
                <h3>Indústria, inovação e infraestrutura</h3>
                <p>
                  Desenvolvemos soluções digitais para aproximar clientes e
                  prestadores e facilitar etapas do atendimento.
                </p>
                <span className="impact-connection">Contribuição alinhada ao objetivo</span>
              </article>

              <article className="impact-card impact-planet-card">
                <div className="impact-art impact-planet-art" aria-hidden="true">
                  <svg viewBox="0 0 96 96" fill="none">
                    <circle cx="48" cy="48" r="43" />
                    <path d="M69 27C48 27 31 34 31 50c0 10 8 17 18 17 15 0 20-18 20-40Z" />
                    <path d="M25 71c8-17 20-27 37-35M48 66c-1-8-5-14-12-18m21 4c-2-6-1-11 3-16" />
                    <path d="M27 72h43" />
                  </svg>
                </div>
                <span className="impact-ods-label">Nosso compromisso</span>
                <h3>Responsabilidade com o planeta</h3>
                <p>
                  Priorizamos processos digitais e queremos dar visibilidade a
                  serviços de manutenção e reparo que ajudam a prolongar a vida
                  útil de produtos.
                </p>
                <span className="impact-connection">Práticas para evoluir e medir</span>
              </article>
            </div>

            <p className="impact-note">
              As ODS são referências para orientar nossa atuação. Estamos no
              início dessa jornada e não apresentamos resultados ambientais ou
              sociais que ainda não tenham sido medidos.
            </p>
          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}
