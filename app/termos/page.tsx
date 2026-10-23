import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { siteConfig } from "@/config/site";

export const metadata = {
  title: "Termos de Uso | VALLEX ServiçoFácil",
  description:
    "Consulte as regras de uso das páginas públicas e da plataforma ServiçoFácil.",
};

export default function TermosPage() {
  return (
    <>
      <Header />
      <main className="document-page">
        <div className="container document-container">
          <header className="document-header">
            <span className="eyebrow">Regras da plataforma</span>
            <h1>Termos de Uso</h1>
            <p>
              Estes termos explicam as condições para usar as páginas públicas
              da VALLEX e os recursos do ServiçoFácil.
            </p>
            <p className="document-meta">Versão 2 · Atualizada em 17/10/2026</p>
          </header>

          <div className="document-body">
            <section>
              <h2>1 Quem somos</h2>
              <p>
                O ServiçoFácil é operado por {siteConfig.legal.companyName},
                CNPJ {siteConfig.legal.cnpj}, sob responsabilidade de Valquimar
                Silva dos Santos. Nosso endereço comercial para identificação
                e contato é {siteConfig.legal.businessAddress}; não há
                atendimento presencial ao público nesse endereço. Fale conosco
                pelo e-mail <a href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a> ou pelo telefone {siteConfig.contact.phone}.
              </p>
            </section>

            <section>
              <h2>2 O ServiçoFácil e o papel da VALLEX</h2>
              <p>
                O ServiçoFácil permite que clientes encontrem prestadores e
                enviem solicitações. Também oferece ferramentas para o
                prestador apresentar o negócio e organizar solicitações,
                propostas, agenda, equipe e informações de gestão.
              </p>
              <p>
                A plataforma registra e encaminha pedidos de contato. No fluxo
                atual, cliente e prestador combinam diretamente escopo, preço,
                disponibilidade, execução e pagamento do serviço. A VALLEX
                não recebe o pagamento do serviço contratado entre eles. O
                envio de uma solicitação não confirma contratação,
                disponibilidade ou resultado, e a VALLEX não garante que haverá
                resposta, orçamento ou contratação.
              </p>
            </section>

            <section>
              <h2>3 Regras para clientes</h2>
              <ul>
                <li>Informe dados corretos e use um contato que possa receber respostas.</li>
                <li>Envie pedidos relacionados ao serviço selecionado e não inclua senhas ou dados pessoais desnecessários.</li>
                <li>Antes de contratar, combine com o prestador preço, materiais, prazo, local, pagamento, cancelamento e demais condições.</li>
                <li>Confira a identidade e as qualificações do profissional quando forem relevantes para o serviço.</li>
              </ul>
            </section>

            <section>
              <h2>4 Regras para prestadores</h2>
              <ul>
                <li>Mantenha atualizados o nome do negócio, a descrição, os serviços, a região de atendimento e os canais que decidiu tornar públicos.</li>
                <li>Publique apenas informações, fotos, marcas e materiais que tenha autorização para usar.</li>
                <li>Informe corretamente valores, disponibilidade, qualificações e limitações dos serviços oferecidos.</li>
                <li>Responda pelos serviços oferecidos, pelas licenças e qualificações exigidas para sua atividade e pelas obrigações fiscais e de emissão de documentos aplicáveis.</li>
                <li>Proteja suas credenciais e responda pelos atos realizados por sua conta e pelos acessos concedidos à equipe.</li>
                <li>Os registros financeiros são ferramentas de organização e não substituem escrituração contábil, emissão fiscal ou orientação profissional.</li>
              </ul>
            </section>

            <section>
              <h2>5 Conta, idade mínima e segurança</h2>
              <p>
                A plataforma destina-se a pessoas com 18 anos ou mais. Ao criar
                uma conta, você declara ter pelo menos 18 anos, fornece
                informações verdadeiras e concorda em manter suas credenciais
                em segurança. Cada usuário deve utilizar sua própria conta e
                responder pelos acessos que autorizar.
              </p>
            </section>

            <section>
              <h2>6 Planos, renovação e cancelamento</h2>
              <p>
                Os recursos, limites, preço e condições vigentes de cada plano
                são apresentados na página de planos e no checkout antes da
                contratação. Os planos pagos têm cobrança recorrente mensal,
                processada pelo Asaas. Ao contratar, você autoriza a cobrança
                mensal do preço então exibido até cancelar a renovação. Novas
                organizações começam com 30 dias de teste do Basic; sem uma
                assinatura paga confirmada ao final, o acesso passa ao plano
                Free.
              </p>
              <p>
                O cancelamento pode ser solicitado na área de planos e impede
                as próximas renovações. O acesso permanece até o final do
                período já pago; cobranças já geradas pelo processador seguem
                as condições do meio de pagamento. A VALLEX avisará mudanças de
                preço ou das condições da assinatura com pelo menos 30 dias de
                antecedência. Se não concordar, você poderá cancelar antes da
                data de vigência da mudança.
              </p>
              <p>
                Nas contratações a distância, o consumidor pode exercer o
                direito de arrependimento no prazo legal de sete dias, quando
                aplicável, pelos canais de atendimento da VALLEX. Quando devido,
                o reembolso integral será solicitado ao meio de pagamento. O
                cancelamento da renovação, por si só, não gera reembolso de
                períodos já utilizados nem afasta os direitos previstos em lei.
              </p>
            </section>

            <section>
              <h2>7 Conteúdo e propriedade intelectual</h2>
              <p>
                Você mantém os direitos sobre o conteúdo que envia. Ao publicar
                descrição, fotos ou logotipo na vitrine, autoriza a VALLEX a
                exibi-los dentro do ServiçoFácil e em divulgação diretamente
                relacionada à plataforma enquanto estiverem publicados. Você
                pode atualizar ou retirar o conteúdo pela área disponível,
                sujeito à conservação de registros exigida por lei ou necessária
                para segurança e exercício regular de direitos.
              </p>
              <p>
                As marcas, o software, o desenho e os demais elementos próprios
                da VALLEX e do ServiçoFácil pertencem à VALLEX ou a seus
                licenciantes. O uso da plataforma não transfere esses direitos.
                Não copie, modifique, distribua ou explore comercialmente
                esses elementos sem autorização, salvo quando a lei permitir.
              </p>
            </section>

            <section>
              <h2>8 Indisponibilidade, suspensão e encerramento</h2>
              <p>
                Recursos podem passar por manutenção, correções e evolução. A
                VALLEX poderá restringir ou suspender uma conta ou conteúdo
                quando houver violação destes termos, suspeita de fraude ou
                risco de segurança, obrigação legal, inadimplência de
                assinatura ou uso que prejudique a plataforma ou terceiros.
                Quando possível e adequado, comunicaremos o motivo e os meios
                para regularização. A conta pode ser encerrada pelo titular;
                dados serão tratados conforme a Política de Privacidade e os
                prazos legais aplicáveis.
              </p>
            </section>

            <section>
              <h2>9 Atendimento e reclamações</h2>
              <p>
                Para tratar de um serviço, procure primeiro o prestador pelos
                canais exibidos na vitrine. Para problemas relacionados à
                plataforma, conta ou assinatura, use a página de{" "}
                <Link href="/contato">Contato</Link> ou escreva para{" "}
                <a href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a>.
                O formulário confirma o recebimento no envio. A VALLEX
                responderá às solicitações de atendimento em até cinco dias,
                observadas as regras legais aplicáveis. Inclua somente as
                informações necessárias para localizar o caso.
              </p>
            </section>

            <section>
              <h2>10 Privacidade, mudanças e legislação</h2>
              <p>
                O tratamento de dados pessoais está descrito na{" "}
                <Link href="/privacidade">Política de Privacidade</Link>. Estes
                termos podem ser atualizados quando os recursos ou regras
                aplicáveis mudarem. A versão vigente, com a data de atualização,
                ficará nesta página; quando uma mudança exigir novo aceite,
                solicitaremos a confirmação antes de continuar o uso do recurso
                correspondente.
              </p>
              <p>
                Aplicam-se as leis brasileiras. Nas relações de consumo, fica
                preservado o foro legalmente assegurado ao consumidor. Para
                controvérsias não sujeitas às regras de proteção do consumidor,
                fica eleito o foro da comarca de Goiânia/GO, ressalvada
                disposição legal obrigatória em contrário.
              </p>
            </section>

            <section>
              <h2>11 Referências normativas</h2>
              <ul className="document-references">
                <li>
                  BRASIL. <a href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" target="_blank" rel="noreferrer">Lei nº 8.078, de 11 de setembro de 1990</a>. Dispõe sobre a proteção do consumidor e dá outras providências. Acesso em: 17 out. 2026.
                </li>
                <li>
                  BRASIL. <a href="https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm" target="_blank" rel="noreferrer">Decreto nº 7.962, de 15 de março de 2013</a>. Regulamenta a contratação no comércio eletrônico. Acesso em: 17 out. 2026.
                </li>
                <li>
                  BRASIL. <a href="https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm" target="_blank" rel="noreferrer">Lei nº 12.965, de 23 de abril de 2014</a>. Estabelece princípios, garantias, direitos e deveres para o uso da Internet no Brasil. Acesso em: 17 out. 2026.
                </li>
                <li>
                  BRASIL. <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm" target="_blank" rel="noreferrer">Lei nº 13.709, de 14 de agosto de 2018</a>. Lei Geral de Proteção de Dados Pessoais (LGPD). Acesso em: 17 out. 2026.
                </li>
              </ul>
            </section>
          </div>

          <nav className="document-related" aria-label="Outras informações">
            <Link href="/privacidade">Política de Privacidade</Link>
            <Link href="/faq">Perguntas frequentes</Link>
            <Link href="/contato">Atendimento VALLEX</Link>
          </nav>
        </div>
      </main>
      <Footer />
    </>
  );
}
