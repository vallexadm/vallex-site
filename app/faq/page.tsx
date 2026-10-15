import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { siteConfig } from "@/config/site";

export const metadata = {
  title: "Perguntas frequentes | VALLEX ServiçoFácil",
  description:
    "Respostas para clientes e prestadores que usam a vitrine e a plataforma ServiçoFácil.",
};

const customerQuestions = [
  {
    question: "Como encontro um prestador?",
    answer:
      "Na página Serviços, pesquise pelo nome ou tipo de serviço e refine por cidade, região e forma de atendimento. A busca começa por Goiânia e pode mostrar outras localidades informadas pelos próprios prestadores.",
  },
  {
    question: "O que acontece quando envio uma solicitação?",
    answer:
      "A solicitação é registrada e encaminhada ao prestador escolhido com os dados necessários para ele entender o pedido e entrar em contato. Enviar uma solicitação não confirma contratação ou disponibilidade.",
  },
  {
    question: "Como combino preço, prazo e pagamento do serviço?",
    answer:
      "Combine diretamente com o prestador o escopo, preço, materiais, prazo, local, pagamento e cancelamento antes de contratar. No fluxo atual, o pagamento do serviço é feito conforme o acordo entre cliente e prestador, fora do ServiçoFácil.",
  },
  {
    question: "A VALLEX garante a qualidade ou a execução do serviço?",
    answer:
      "A VALLEX oferece a vitrine e ferramentas para facilitar o contato. A proposta, a execução e as condições do serviço são tratadas entre cliente e prestador. Confira as informações e qualificações do profissional que forem importantes para o seu caso.",
  },
  {
    question: "Não consegui contato com o prestador. O que faço?",
    answer:
      "Tente os canais exibidos na vitrine. Se houver um problema relacionado ao uso da plataforma ou quiser registrar um relato, use a página Contato ou escreva para o e-mail comercial da VALLEX com o nome do prestador e os dados necessários para localizar a solicitação.",
  },
];

const providerQuestions = [
  {
    question: "Como começo a usar o ServiçoFácil?",
    answer:
      "Crie sua conta na Área do prestador e conclua o cadastro do negócio. Depois configure a vitrine, os serviços e os canais que quer disponibilizar. A publicação depende de preencher as informações solicitadas na própria área.",
  },
  {
    question: "Preciso divulgar meu endereço residencial?",
    answer:
      "Não. Informe apenas uma localização comercial ou uma região de atendimento que deseja tornar pública. Você pode indicar atendimento em uma cidade ou região, em domicílio ou online conforme as opções disponíveis para o seu serviço.",
  },
  {
    question: "Quais dados aparecem na vitrine?",
    answer:
      "A vitrine exibe as informações públicas que você configura, como nome, descrição, serviços, região, formas de atendimento e contatos selecionados. Revise a prévia antes de publicar e não inclua dados que não queira compartilhar com clientes.",
  },
  {
    question: "O financeiro do ServiçoFácil substitui um contador?",
    answer:
      "Não. O módulo ajuda a registrar serviços, recebimentos, custos e despesas e apresenta indicadores estimados com base nesses lançamentos. Ele não substitui contabilidade, emissão fiscal nem orientação tributária.",
  },
  {
    question: "Como funcionam os planos e a assinatura?",
    answer:
      "Os recursos e valores vigentes aparecem na página de planos. A cobrança da assinatura é processada pelo Asaas. Você pode cancelar a renovação na área de planos; seu acesso continua até o fim do período pago. Cancelar a renovação não gera automaticamente reembolso. Se quiser solicitar análise de reembolso, fale com a VALLEX, sem prejuízo dos direitos previstos em lei.",
  },
  {
    question: "Os clientes veem meus custos internos?",
    answer:
      "Os custos registrados no módulo financeiro são informações de gestão da sua organização. Ao preparar qualquer proposta ou material fora da plataforma, revise o conteúdo antes de enviá-lo para garantir que incluiu somente as informações destinadas ao cliente.",
  },
];

function QuestionList({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="faq-list">
      {items.map((item) => (
        <details className="faq-item" key={item.question}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export default function FaqPage() {
  return (
    <>
      <Header />
      <main className="document-page">
        <div className="container document-container">
          <header className="document-header">
            <span className="eyebrow">Ajuda VALLEX | ServiçoFácil</span>
            <h1>Perguntas frequentes</h1>
            <p>
              Escolha seu perfil para encontrar respostas sobre a vitrine, as
              solicitações e as ferramentas para prestadores.
            </p>
          </header>

          <section className="faq-section" aria-labelledby="faq-clientes">
            <h2 id="faq-clientes">Para clientes</h2>
            <QuestionList items={customerQuestions} />
          </section>

          <section className="faq-section" aria-labelledby="faq-prestadores">
            <h2 id="faq-prestadores">Para prestadores</h2>
            <QuestionList items={providerQuestions} />
          </section>

          <section className="faq-support">
            <div>
              <span className="eyebrow">Precisa de ajuda?</span>
              <h2>Fale com a VALLEX</h2>
              <p>
                Para problemas com a plataforma, uma conta ou uma assinatura,
                entre em contato. Para relatar um atendimento, informe o nome
                do prestador, quando aconteceu e o que precisa de análise. Não
                envie senhas ou dados sensíveis.
              </p>
              <p>
                A VALLEX ainda não está divulgando um perfil oficial próprio no
                Reclame Aqui. Links para prestadores também devem apontar apenas
                para perfis oficiais informados por eles.
              </p>
            </div>
            <div className="faq-support-actions">
              <Link href="/contato" className="button button-primary">
                Abrir contato
              </Link>
              <a className="button button-outline" href={`mailto:${siteConfig.contact.email}`}>
                Enviar e-mail
              </a>
            </div>
          </section>

          <nav className="document-related" aria-label="Políticas da plataforma">
            <Link href="/privacidade">Política de Privacidade</Link>
            <Link href="/termos">Termos de Uso</Link>
          </nav>
        </div>
      </main>
      <Footer />
    </>
  );
}
