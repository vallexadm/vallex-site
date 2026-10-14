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
              Estes termos descrevem como clientes e prestadores podem usar as
              páginas públicas da VALLEX e os recursos do ServiçoFácil.
            </p>
            <p className="document-meta">Versão inicial · Atualizada em 14/10/2026</p>
          </header>

          <aside className="document-review-note">
            <strong>Versão inicial para revisão jurídica.</strong>
            <span>
              A identificação empresarial e o endereço comercial cadastrado
              foram preenchidos. Antes da publicação final, validar as
              condições de assinatura e reembolso com orientação jurídica e
              formalizar o fluxo interno de suporte e reclamações.
            </span>
          </aside>

          <div className="document-body">
            <section>
              <h2>1. Sobre o ServiçoFácil</h2>
              <p>
                O ServiçoFácil é uma plataforma da VALLEX que ajuda clientes a
                encontrar prestadores e enviar solicitações. Também oferece
                ferramentas para o prestador apresentar o negócio e organizar
                solicitações, propostas, agenda, equipe e informações
                financeiras.
              </p>
              <p>
                A plataforma registra e encaminha pedidos de contato. No fluxo
                atual, o prestador e o cliente combinam diretamente o escopo,
                o preço, a disponibilidade, a execução e o pagamento do
                serviço. O ServiçoFácil não recebe o pagamento do serviço
                contratado entre eles.
              </p>
            </section>

            <section>
              <h2>2. Regras para clientes</h2>
              <ul>
                <li>Informe dados corretos e use um contato que possa receber respostas.</li>
                <li>Envie pedidos relacionados ao serviço selecionado e não inclua senhas ou dados pessoais desnecessários.</li>
                <li>Combine com o prestador, antes da contratação, preço, materiais, prazo, local, pagamento, cancelamento e demais condições.</li>
                <li>Confira a identidade e as qualificações do profissional quando forem relevantes para o serviço.</li>
              </ul>
            </section>

            <section>
              <h2>3. Regras para prestadores</h2>
              <ul>
                <li>Mantenha atualizados o nome do negócio, a descrição, os serviços, a região de atendimento e os canais que decidiu tornar públicos.</li>
                <li>Publique apenas informações, fotos, marcas e materiais que tenha autorização para usar.</li>
                <li>Informe corretamente valores, disponibilidade, qualificações e limitações dos serviços oferecidos.</li>
                <li>Proteja suas credenciais e responda pelos atos realizados por sua conta e pelos acessos concedidos à equipe.</li>
                <li>Use os registros financeiros como ferramenta de organização; eles não substituem escrituração contábil, orientação tributária ou conferência profissional.</li>
              </ul>
            </section>

            <section>
              <h2>4. Relação entre cliente e prestador</h2>
              <p>
                O prestador é responsável por avaliar o pedido, apresentar a
                proposta, informar condições, executar o serviço e tratar
                diretamente com o cliente sobre o atendimento. O envio de uma
                solicitação não confirma contratação, disponibilidade ou
                resultado. A VALLEX não garante que haverá resposta, orçamento
                ou contratação.
              </p>
              <p>
                A VALLEX pode receber relatos sobre uso da plataforma e tomar
                medidas relacionadas às contas e conteúdos, mas esse canal não
                substitui a solução direta entre as partes nem os direitos e
                meios legais de cada pessoa.
              </p>
            </section>

            <section>
              <h2>5. Conta, assinatura e pagamentos</h2>
              <p>
                O ServiçoFácil é operado por 64.543.250 VALQUIMAR SILVA DOS
                SANTOS, CNPJ 64.543.250/0001-50, sob responsabilidade de
                Valquimar Silva dos Santos, com endereço comercial cadastrado
                na Rua Rio de Janeiro, nº 366, Casa 02, Q23/L12, Vila Jardim
                São Judas Tadeu, Goiânia/GO, CEP 74685-410. Este é o endereço
                comercial da empresa para identificação e contato; não é um
                endereço de atendimento presencial ao público. A área do
                prestador exige uma conta individual. Os recursos e limites de
                cada plano são apresentados na página de planos e no checkout.
                As cobranças de assinatura são processadas pelo Asaas conforme
                as condições exibidas antes da contratação.
              </p>
              <p>
                A assinatura do ServiçoFácil é separada do valor dos serviços
                prestados aos clientes. A VALLEX não processa esses pagamentos
                de serviço no fluxo atual. O prestador pode cancelar a renovação
                na área de planos. O cancelamento interrompe as próximas
                renovações, e o acesso permanece até o fim do período pago. Esse
                cancelamento não é, por si só, um pedido de reembolso nem afasta
                direitos previstos em lei, inclusive o direito de arrependimento
                quando aplicável. Para solicitar análise de reembolso, use a
                página de Contato; quando devido, o estorno será encaminhado ao
                meio de pagamento conforme a legislação e as regras do provedor
                de cobrança.
              </p>
            </section>

            <section>
              <h2>6. Conteúdo e uso adequado</h2>
              <p>
                Você mantém os direitos sobre o conteúdo que envia. Ao publicar
                dados, descrição, fotos ou logotipo na vitrine, autoriza a
                VALLEX a exibi-los dentro do ServiçoFácil e em sua divulgação
                diretamente relacionada à plataforma enquanto o conteúdo
                estiver publicado. Você pode atualizar ou retirar o conteúdo
                pela área disponível, sujeito à conservação de registros que
                precisem ser mantidos por razões legais ou de segurança.
              </p>
              <p>
                Não é permitido usar a plataforma para fraude, assédio,
                discriminação, violação de direitos, envio de conteúdo ilegal,
                tentativa de acesso não autorizado ou coleta de dados de outras
                pessoas sem finalidade legítima.
              </p>
            </section>

            <section>
              <h2>7. Disponibilidade e mudanças</h2>
              <p>
                Recursos podem passar por manutenção, correções e evolução. Se
                uma conta ou conteúdo aparentar violar estes termos ou a lei, a
                VALLEX poderá analisar o caso e limitar temporariamente o
                acesso quando necessário, buscando comunicar o responsável
                pelos canais cadastrados.
              </p>
            </section>

            <section>
              <h2>8. Atendimento, dúvidas e reclamações</h2>
              <p>
                Para tratar de um serviço, procure primeiro o prestador pelos
                canais exibidos na vitrine. Para problemas relacionados à
                plataforma, conta ou assinatura, use a página de{" "}
                <Link href="/contato">Contato</Link> ou escreva para{" "}
                <a href={`mailto:${siteConfig.contact.email}`}>
                  {siteConfig.contact.email}
                </a>
                . O formulário confirma o recebimento no envio. A VALLEX busca
                responder às solicitações em até cinco dias, observados os
                prazos legais aplicáveis. Inclua apenas as informações
                necessárias para localizar o caso.
              </p>
              <p>
                A VALLEX ainda não está indicando nesta página um perfil
                oficial da empresa no Reclame Aqui. Links externos só serão
                exibidos após confirmação do perfil oficial correspondente.
              </p>
            </section>

            <section>
              <h2>9. Privacidade e contato</h2>
              <p>
                O tratamento de dados pessoais é descrito na{" "}
                <Link href="/privacidade">Política de Privacidade</Link>. Para
                falar com a VALLEX, use {siteConfig.contact.email} ou o telefone{" "}
                {siteConfig.contact.phone}.
              </p>
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
