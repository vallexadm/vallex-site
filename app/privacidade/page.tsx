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
              Esta versão explica, em linguagem simples, como a VALLEX e o
              ServiçoFácil usam dados pessoais nas páginas públicas e na área
              do prestador.
            </p>
            <p className="document-meta">Versão inicial · Atualizada em 15/10/2026</p>
          </header>

          <aside className="document-review-note">
            <strong>Versão para revisão antes da publicação final.</strong>
            <span>
              A identificação empresarial e o endereço comercial cadastrado
              foram preenchidos. Ainda precisamos definir os prazos por
              categoria e confirmar a região do projeto Supabase.
            </span>
          </aside>

          <div className="document-body">
            <section>
              <h2>1. Quem trata os dados</h2>
              <p>
                A plataforma VALLEX | ServiçoFácil é operada por 64.543.250
                VALQUIMAR SILVA DOS SANTOS, inscrita no CNPJ sob o nº
                64.543.250/0001-50, sob responsabilidade de Valquimar Silva dos
                Santos, com endereço comercial cadastrado na Rua Rio de
                Janeiro, nº 366, Casa 02, Q23/L12, Vila Jardim São Judas Tadeu,
                Goiânia/GO, CEP 74685-410. Esse endereço identifica a empresa e
                não representa um local de atendimento presencial ao público.
                A plataforma apresenta prestadores e ajuda a organizar
                solicitações, orçamentos, agenda e informações de gestão. Para
                dúvidas ou pedidos sobre dados pessoais, fale conosco pelo
                e-mail{" "}
                <a href={`mailto:${siteConfig.contact.email}?subject=Privacidade%20e%20dados%20pessoais`}>
                  {siteConfig.contact.email}
                </a>{" "}
                ou pelo telefone {siteConfig.contact.phone}.
              </p>
              <p>
                O papel da VALLEX e do prestador pode variar conforme a
                finalidade de cada tratamento. O prestador, por exemplo,
                também decide como usar os dados que recebe para responder e
                executar o atendimento contratado.
              </p>
            </section>

            <section>
              <h2>2. Quais dados podem ser tratados</h2>
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
                  solicitações, agenda e informações inseridas nos módulos de
                  gestão.
                </li>
                <li>
                  <strong>Gestão financeira:</strong> valores de serviços,
                  recebimentos, custos, despesas e contas a pagar registrados
                  pelo próprio prestador.
                </li>
                <li>
                  <strong>Assinatura do ServiçoFácil:</strong> dados necessários
                  para identificar a conta, o plano e o status da assinatura.
                  A cobrança de assinatura é processada pelo Asaas; a VALLEX
                  não solicita que o usuário envie dados de cartão por
                  formulários próprios.
                </li>
                <li>
                  <strong>Horário e clima local:</strong> a cidade aproximada,
                  o fuso horário e as coordenadas aproximadas inferidas do
                  acesso podem ser usados para exibir o horário e as condições
                  atuais da região. Esses dados não identificam um endereço
                  exato.
                </li>
              </ul>
            </section>

            <section>
              <h2>3. Para que usamos os dados</h2>
              <p>
                Usamos os dados para responder contatos, encaminhar e registrar
                solicitações de orçamento, manter contas e vitrines, fornecer
                os recursos da plataforma, administrar assinaturas, prevenir
                uso indevido e cumprir obrigações legais. A base legal depende
                da finalidade e pode incluir procedimentos solicitados pelo
                titular, execução de contrato, obrigação legal, legítimo
                interesse avaliado para o caso ou consentimento quando
                necessário.
              </p>
            </section>

            <section>
              <h2>4. Quando compartilhamos informações</h2>
              <p>
                Quando você envia uma solicitação pela vitrine, os dados
                necessários para aquele pedido são compartilhados com o
                prestador escolhido, para que ele possa responder. Também
                utilizamos fornecedores de infraestrutura e autenticação,
                armazenamento de dados e cobrança de assinaturas, incluindo
                Supabase e Asaas, conforme a função de cada serviço. A região
                do projeto Supabase ainda será confirmada na configuração da
                conta. Não vendemos dados pessoais.
              </p>
              <p>
                Para mostrar informações locais, a hospedagem Netlify fornece
                uma estimativa de cidade e coordenadas com base no acesso. As
                coordenadas aproximadas são consultadas no serviço Open-Meteo
                para obter as condições atuais do clima. A estimativa pode não
                corresponder à cidade real, especialmente quando a conexão usa
                VPN ou rede corporativa.
              </p>
              <p>
                Depois de receber uma solicitação, o prestador pode tratar os
                dados para conversar com você e realizar o serviço. Pergunte a
                ele como essas informações são usadas e guardadas.
              </p>
            </section>

            <section>
              <h2>5. Por quanto tempo guardamos os dados</h2>
              <p>
                Mantemos informações pelo tempo necessário para prestar os
                recursos solicitados, administrar a conta, tratar uma
                solicitação ou reclamação, proteger a plataforma e cumprir
                obrigações legais. Encerrada a finalidade, os dados serão
                eliminados ou anonimizados quando possível, salvo quando a
                conservação for necessária por obrigação legal, regulatória,
                segurança ou exercício regular de direitos. Os registros de
                acesso à aplicação sujeitos ao Marco Civil da Internet serão
                mantidos sob sigilo e segurança pelo prazo legal de seis meses.
                Documentos de assinatura e registros financeiros seguem os
                prazos legais aplicáveis. Os períodos internos para solicitações
                de contato e dados de contas encerradas ainda serão definidos
                após o mapeamento de retenção e dos backups.
              </p>
            </section>

            <section>
              <h2>6. Seus direitos e como falar conosco</h2>
              <p>
                Você pode solicitar confirmação e acesso aos dados, correção,
                informação sobre compartilhamentos e, conforme a situação,
                anonimização, bloqueio ou eliminação, portabilidade, oposição
                ou revogação de consentimento. A lei pode permitir a
                conservação de alguns dados mesmo após um pedido de exclusão.
              </p>
              <p>
                Envie seu pedido para{" "}
                <a href={`mailto:${siteConfig.contact.email}?subject=Solicita%C3%A7%C3%A3o%20LGPD`}>
                  {siteConfig.contact.email}
                </a>{" "}
                com o assunto “Privacidade e dados pessoais”. Podemos pedir
                informações proporcionais para confirmar a identidade e
                localizar o registro correto.
              </p>
            </section>

            <section>
              <h2>7. Segurança, sessão e cookies</h2>
              <p>
                Adotamos medidas técnicas e administrativas compatíveis com a
                plataforma para reduzir riscos de acesso ou uso indevido. Nenhum
                sistema conectado à internet pode prometer segurança absoluta.
                A área do prestador utiliza recursos de autenticação e sessão
                para manter o acesso à conta. Se forem adicionadas tecnologias
                de análise ou publicidade, esta política e os controles
                correspondentes deverão ser atualizados.
              </p>
            </section>

            <section>
              <h2>8. Atualizações desta política</h2>
              <p>
                Podemos atualizar este texto quando os recursos, fornecedores
                ou regras aplicáveis mudarem. A versão vigente ficará nesta
                página com a data da última atualização.
              </p>
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
