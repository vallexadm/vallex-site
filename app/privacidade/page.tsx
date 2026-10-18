import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { siteConfig } from "@/config/site";

export const metadata = {
  title: "Política de Privacidade | VALLEX ServiçoFácil",
  description:
    "Entenda como a VALLEX trata dados pessoais nas páginas públicas e no ServiçoFácil.",
};

export default function PrivacidadePage() {
  return (
    <>
      <Header />
      <main className="document-page">
        <div className="container document-container">
          <header className="document-header">
            <span className="eyebrow">Transparência e proteção de dados</span>
            <h1>Política de Privacidade</h1>
            <p>
              Esta política explica como a VALLEX e o ServiçoFácil tratam dados
              pessoais nas páginas públicas e na área do prestador.
            </p>
            <p className="document-meta">Versão 2 · Atualizada em 17/10/2026</p>
          </header>

          <div className="document-body">
            <section>
              <h2>1 Quem somos e como atuamos</h2>
              <p>
                A plataforma VALLEX | ServiçoFácil é operada por{" "}
                {siteConfig.legal.companyName}, CNPJ {siteConfig.legal.cnpj},
                sob responsabilidade de Valquimar Silva dos Santos. Nosso
                endereço comercial para identificação e contato é{" "}
                {siteConfig.legal.businessAddress}; não há atendimento
                presencial ao público nesse endereço. Para dúvidas ou pedidos
                sobre dados pessoais, escreva para{" "}
                <a href={`mailto:${siteConfig.contact.email}?subject=Privacidade%20e%20dados%20pessoais`}>
                  {siteConfig.contact.email}
                </a>{" "}
                ou ligue para {siteConfig.contact.phone}.
              </p>
              <ul>
                <li>
                  A VALLEX é controladora dos dados usados para administrar o
                  site, as contas, o cadastro da organização, as assinaturas,
                  o suporte e a segurança da plataforma.
                </li>
                <li>
                  Ao receber os dados de um pedido enviado por sua vitrine, o
                  prestador decide como usá-los para responder, negociar e
                  executar o atendimento e atua como controlador independente
                  desse tratamento.
                </li>
                <li>
                  Nos módulos de gestão em que o prestador registra dados de
                  seus próprios clientes e atendimentos, a VALLEX trata esses
                  dados como operadora, conforme as instruções e finalidades
                  definidas pelo prestador controlador.
                </li>
              </ul>
            </section>

            <section>
              <h2>2 Dados que podemos tratar</h2>
              <ul>
                <li>
                  <strong>Contato com a VALLEX:</strong> nome, telefone,
                  e-mail, assunto, descrição da necessidade, datas preferidas e
                  sugestões enviadas pelo formulário.
                </li>
                <li>
                  <strong>Solicitação a um prestador:</strong> nome, telefone,
                  e-mail, serviço escolhido, descrição, endereço informado,
                  preferência de data e horário e observações.
                </li>
                <li>
                  <strong>Conta do prestador:</strong> dados de acesso e
                  identificação do negócio, perfil público, contatos,
                  localização e região de atendimento, serviços, imagens,
                  solicitações, agenda, equipe e informações inseridas nos
                  módulos de gestão.
                </li>
                <li>
                  <strong>Assinatura:</strong> dados necessários para
                  identificar a conta, o plano, o pagamento e o status da
                  assinatura. A cobrança é processada pelo Asaas; a VALLEX não
                  pede que o usuário envie dados de cartão em formulário
                  próprio.
                </li>
                <li>
                  <strong>Registros técnicos:</strong> dados de autenticação,
                  sessão, data e hora de acesso e informações técnicas
                  necessárias para funcionamento, segurança e prevenção a
                  fraudes.
                </li>
                <li>
                  <strong>Horário e clima local:</strong> cidade aproximada,
                  fuso horário e coordenadas aproximadas inferidas do acesso
                  para mostrar o horário e as condições atuais da região. Esses
                  dados não identificam um endereço exato.
                </li>
              </ul>
            </section>

            <section>
              <h2>3 Finalidades e bases legais</h2>
              <p>
                A base legal depende da finalidade concreta. Nos módulos em que
                a VALLEX atua como operadora, o prestador controlador define a
                finalidade e a base legal do tratamento que realiza.
              </p>
              <ul>
                <li><strong>Responder contatos e encaminhar solicitações:</strong> procedimentos preliminares relacionados a contrato, solicitados pelo titular (LGPD, art. 7º, V).</li>
                <li><strong>Criar e administrar conta, fornecer recursos e cobrar assinatura:</strong> execução de contrato ou de procedimentos preliminares (art. 7º, V).</li>
                <li><strong>Manter registros fiscais, contábeis e de acesso exigidos:</strong> cumprimento de obrigação legal ou regulatória (art. 7º, II).</li>
                <li><strong>Proteger contas, prevenir fraude e manter a segurança:</strong> legítimo interesse, após avaliação de necessidade e direitos dos titulares (art. 7º, IX), ou outra base aplicável ao caso.</li>
                <li><strong>Enviar comunicações promocionais não essenciais:</strong> consentimento quando exigido; você pode retirar o consentimento pelo canal indicado na mensagem ou pelo contato da VALLEX.</li>
              </ul>
            </section>

            <section>
              <h2>4 Compartilhamento e localização dos dados</h2>
              <p>
                Quando você envia uma solicitação pela vitrine, os dados
                necessários para aquele pedido são encaminhados ao prestador
                escolhido. Também utilizamos fornecedores de infraestrutura,
                autenticação, armazenamento e cobrança, incluindo Supabase e
                Asaas, cada qual conforme sua função. O projeto de dados da
                VALLEX está configurado na região South America (São Paulo,
                Brasil). Alguns fornecedores podem processar dados em outros
                países; quando houver transferência internacional, ela seguirá
                os mecanismos previstos na LGPD e na regulamentação da ANPD.
                Não vendemos dados pessoais.
              </p>
              <p>
                Para exibir informações locais, a hospedagem Netlify fornece
                uma estimativa de cidade e coordenadas aproximadas com base no
                acesso. O serviço Open-Meteo recebe essas coordenadas para
                consultar as condições atuais do clima. A estimativa pode não
                corresponder à cidade real, especialmente quando a conexão usa
                VPN ou rede corporativa.
              </p>
              <p>
                Depois de receber uma solicitação, o prestador pode tratar os
                dados para conversar com você e realizar o serviço. Consulte a
                política ou os canais do próprio prestador para saber como ele
                guarda essas informações.
              </p>
            </section>

            <section>
              <h2>5 Retenção, encerramento de conta e exclusão</h2>
              <p>
                Mantemos dados pelo tempo necessário para as finalidades
                informadas e os eliminamos ou anonimizamos quando deixam de ser
                necessários, ressalvadas obrigações legais, regulatórias,
                segurança e exercício regular de direitos. A legislação não
                estabelece um prazo único para apagar todos os dados de uma
                conta encerrada; por isso, aplicamos o prazo específico de cada
                categoria e eliminamos os demais dados após o encerramento da
                finalidade e dos tratamentos pendentes.
              </p>
              <ul>
                <li>Registros de acesso à aplicação sujeitos ao Marco Civil da Internet são mantidos sob sigilo e segurança pelo prazo legal de seis meses.</li>
                <li>Documentos fiscais, contábeis e registros de contratação são conservados pelo prazo exigido para cada obrigação e para o exercício regular de direitos; não há um prazo único aplicável a todos os documentos.</li>
                <li>Pedidos de contato e dados de contas encerradas são eliminados ou anonimizados quando a finalidade termina, salvo se houver uma obrigação ou necessidade legal de conservação. Não adotamos um prazo genérico sem previsão legal para todos esses dados.</li>
                <li>Registros de incidentes de segurança com dados pessoais são mantidos pelo prazo regulamentar mínimo de cinco anos.</li>
              </ul>
              <p>
                Backups técnicos, quando disponíveis no plano do fornecedor,
                seguem o ciclo de retenção configurado para esse serviço e não
                autorizam o uso contínuo dos dados. Se uma cópia for restaurada,
                as exclusões já solicitadas serão reaplicadas no ambiente
                restaurado. Para pedir o encerramento da conta ou exclusão de
                dados, entre em contato pelo canal abaixo; a VALLEX explicará
                quais informações precisam permanecer e por quê.
              </p>
            </section>

            <section>
              <h2>6 Seus direitos e prazos de atendimento</h2>
              <p>
                Você pode solicitar confirmação de tratamento, acesso, correção,
                informação sobre compartilhamentos, anonimização, bloqueio ou
                eliminação quando cabíveis, portabilidade, oposição e revogação
                de consentimento. Para a declaração completa prevista no art.
                19, II, da LGPD, a resposta será fornecida em até 15 dias,
                observadas as hipóteses e exceções legais. Também é possível
                apresentar petição à Autoridade Nacional de Proteção de Dados
                (ANPD).
              </p>
              <p>
                Envie seu pedido para{" "}
                <a href={`mailto:${siteConfig.contact.email}?subject=Solicita%C3%A7%C3%A3o%20LGPD`}>
                  {siteConfig.contact.email}
                </a>{" "}
                com o assunto “Privacidade e dados pessoais”. Podemos solicitar
                informações proporcionais para confirmar sua identidade e
                localizar o registro correto.
              </p>
            </section>

            <section>
              <h2>7 Encarregado, segurança e incidentes</h2>
              <p>
                A VALLEX informa enquadrar-se como agente de tratamento de
                pequeno porte, nos termos da Resolução CD/ANPD nº 2/2022, e por
                isso não indica encarregado formal. Para exercer direitos,
                esclarecer dúvidas ou enviar comunicações sobre dados pessoais,
                disponibilizamos o canal {" "}
                <a href={`mailto:${siteConfig.contact.email}?subject=Privacidade%20e%20dados%20pessoais`}>
                  {siteConfig.contact.email}
                </a>.
              </p>
              <p>
                Adotamos medidas técnicas e administrativas compatíveis com a
                plataforma para reduzir riscos de acesso ou uso indevido. Se
                ocorrer incidente que possa acarretar risco ou dano relevante,
                a VALLEX comunicará a ANPD e os titulares afetados no prazo
                regulamentar de três dias úteis, ressalvado prazo diferente
                previsto em lei específica. Nenhum sistema conectado à internet
                pode prometer segurança absoluta.
              </p>
            </section>

            <section>
              <h2>8 Sessão, cookies e atualizações</h2>
              <p>
                A área do prestador utiliza recursos de autenticação e sessão
                necessários para manter o acesso à conta. Se forem adicionadas
                tecnologias de análise ou publicidade, esta política e os
                controles correspondentes serão atualizados. Podemos revisar
                este texto quando os recursos, fornecedores ou regras
                aplicáveis mudarem. A versão vigente e a data da última
                atualização ficarão nesta página.
              </p>
            </section>

            <section>
              <h2>9 Referências normativas</h2>
              <ul className="document-references">
                <li>
                  AUTORIDADE NACIONAL DE PROTEÇÃO DE DADOS (Brasil). <a href="https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022" target="_blank" rel="noreferrer">Resolução CD/ANPD nº 2, de 27 de janeiro de 2022</a>. Aprova o Regulamento de aplicação da LGPD para agentes de tratamento de pequeno porte. Acesso em: 17 out. 2026.
                </li>
                <li>
                  AUTORIDADE NACIONAL DE PROTEÇÃO DE DADOS (Brasil). <a href="https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/documentos/rcis___anonimizado_final_ocultado_2_parte3.pdf" target="_blank" rel="noreferrer">Resolução CD/ANPD nº 15, de 24 de abril de 2024</a>. Aprova o Regulamento de Comunicação de Incidente de Segurança. Acesso em: 17 out. 2026.
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
            <Link href="/termos">Termos de Uso</Link>
            <Link href="/faq">Perguntas frequentes</Link>
            <Link href="/contato">Fale com a VALLEX</Link>
          </nav>
        </div>
      </main>
      <Footer />
    </>
  );
}
