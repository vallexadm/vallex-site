# Ajustes do prestador no checkout local

Data: 20 de outubro de 2026.

Diretório de trabalho autorizado: `C:\vallex-site`.

## Lote 1 implementado

- **Financeiro:** edição de cobrança após baixa de parcela não soma duas vezes o valor recebido. Mantém validação de entrada, saldo, valores já pagos, organização e histórico. Arquivo base ajustado e migração incremental `supabase/financeiro_correcao_edicao_parcelas_recebidas.sql` criada.
- **Orçamentos:** o identificador salvo é mantido antes do upload. Se um arquivo falhar, a tentativa seguinte edita o mesmo orçamento e envia apenas os anexos pendentes. Bloqueio imediato impede dois envios simultâneos no mesmo formulário.
- **Permissões:** a tela impede alterações concorrentes enquanto salva a matriz de permissões. O bloqueio é imediato e liberado em caso de sucesso, falha ou sessão ausente. Esta correção cobre concorrência na mesma tela, não o conflito entre dois navegadores/administradores.

## Validação

- 18 testes com PostgreSQL local, incluindo reprodução do problema anterior e preservação de dados: aprovados.
- 5 testes dos handlers reais da interface com rede e estado isolados: aprovados. Cobrem falha no segundo anexo e retomada, duplo envio, sessão ausente, concorrência em permissões e recuperação após falha.
- 17 testes existentes de assinatura e webhook: aprovados.
- TypeScript: aprovado.
- ESLint dos dois módulos de interface alterados: aprovado, sem avisos.
- `git diff --check` dos arquivos alterados nesta etapa: aprovado. Há avisos de espaços em alterações preexistentes da administração, fora deste lote.
- Build de produção com webpack: aprovado, incluindo compilação, TypeScript e geração das 75 páginas estáticas.

Testes adicionados ao repositório:

```powershell
node --test tests/provider-save-flows.test.mjs
node --test tests/financeiro-edicao-parcelas.test.mjs
```

O segundo comando requer o pacote de teste `@electric-sql/pglite` disponível ou a variável `VALLEX_PGLITE_MODULE` apontando para o arquivo `dist/index.js` desse pacote. Nesta sessão, o pacote está instalado no runtime isolado do workspace e foi fornecido por essa variável; nenhuma dependência de produção foi adicionada. O teste usa apenas um banco local em memória.

## Pendência externa

A migração ainda não foi aplicada ao Supabase de homologação ou produção. Não há conector Supabase disponível nesta sessão. Código local e build não alteram a função já instalada no banco. Aplicar em homologação o arquivo SQL incremental completo e validar pela interface antes de promover.

## Controle da entrega

As alterações preexistentes do usuário foram preservadas. Não houve commit, push, publicação no Netlify ou cobrança real. No futuro commit, revisar explicitamente os arquivos pretendidos; existem pastas de backup e outros arquivos não rastreados anteriores a este lote.

Demais itens da varredura continuam pendentes, incluindo idempotência de recebimentos no servidor, aplicação centralizada de benefícios dos planos, desligamento de colaborador, remarcação/conflitos de agenda, aceite do cliente, continuidade entre módulos e melhorias de suporte.

## Ajuste de baixa por parcela

Relato: a primeira parcela aparecia repetida e a cobrança terminava quitada. Consulta somente de leitura à cobrança de teste mostrou dois recebimentos de R$500, da primeira e segunda parcelas, separados por aproximadamente 34 segundos. Não foi possível determinar a origem dos dois envios somente por esses registros. Nenhum dado foi alterado ou removido.

Ajustes em app/sistema/financeiro/page.tsx: seleção obrigatória de parcela a cada abertura; parcelas quitadas bloqueadas; limite de valor por saldo da parcela; bloqueio síncrono contra envio concorrente; congelamento da parcela e valor submetidos; encerramento do formulário após sucesso; botão e confirmação com valor e número da parcela; resumo único e ordenado de parcelas. O histórico detalhado permanece na seção de recebimentos.

Validação desta rodada: 10 testes de handlers e resumo, 20 testes de PostgreSQL local, TypeScript e lint aprovados. Um teste confirma que receber R$500 na primeira parcela deixa R$500 pendentes e não altera os vencimentos. Não foi executado novo build nesta rodada nem efetuada nova baixa no banco conectado. Estes controles não substituem idempotência persistente no servidor contra repetição após falha de rede, que segue no roteiro.

Não é necessária uma nova migração para as mudanças desta rodada. Atualizar a página local para testar com uma nova cobrança fictícia; a cobrança antiga continua quitada porque contém as duas baixas registradas.
## Cliente avulso e despesas de colaboradores

Implementados no checkout C:\vallex-site:

- Financeiro oferece Usar cliente avulso. Uma função no banco cria ou reutiliza um cadastro sinalizado, único por organização. Registros identificados existentes não são convertidos nem mesclados.
- Despesas oferecem a categoria Serviços de colaboradores e seleção de membro da equipe. O servidor consulta o vínculo na organização autenticada e usa o nome cadastrado, sem aceitar nome ou organização fornecidos pelo navegador. ID e nome histórico são persistidos na despesa; a descrição inclui o nome para os relatórios atuais.
- Equipe oferece Registrar pagamento e direciona ao formulário financeiro com a pessoa preenchida. Valor, descrição do serviço e datas continuam sob confirmação do usuário. Não há cálculo automático de salário, comissão ou valor da agenda. A seleção inicia como Pendente.
- Pagamentos de colaboradores entram nas despesas gerais. Não são lançados automaticamente como custo direto de serviço, para preservar o modelo atual. A tela orienta a não repetir custos já registrados.

Migração pendente: supabase/financeiro_cliente_avulso_colaborador.sql. Executar no VALLEX-Teste e testar antes de produção. Acrescenta sinalizador/índice do cliente avulso, função de reutilização e campos opcionais de colaborador na despesa; não altera lançamentos anteriores. Não aplicada por esta sessão.

Validação: 39 testes dos fluxos e PostgreSQL local aprovados, TypeScript e lint dos quatro arquivos de produção alterados aprovados. Testes cobrem reutilização, separação entre organizações, reativação, chamadas repetidas, histórico de colaborador removido e rejeição de vínculo de outra empresa. Não houve registro de cobrança, despesa ou pagamento no banco conectado, nem commit/deploy nesta rodada.
## Validação visual compartilhada dos formulários

Incluído components/FormValidation.tsx no layout raiz, com lib/form-validation.ts e estilos globais. Campos obrigatórios vazios recebem borda vermelha e mensagem em português ao sair do campo ou tentar enviar. O envio inválido é bloqueado e os erros somem quando corrigidos. Opcionais permanecem opcionais; campos desabilitados e somente de consulta são desconsiderados. A mesma lógica cobre formulários e modais adicionados depois, incluindo grupos de rádio e aceite por checkbox.

CurrencyInput continua controlado pelo formulário e agora valida formato, mínimo e máximo durante edição e envio. São preservadas mensagens acessíveis e referências de ajuda existentes. Espaços em branco não atendem campos obrigatórios de texto. A mudança não torna filtros ou campos opcionais obrigatórios, nem substitui validações de autorização e regras de negócio das APIs.

Verificação: 10 testes em Edge headless e 14 testes de regressão dos fluxos aprovados; TypeScript e lint aprovados. Formulário real de contato em localhost:3000 conferido com campos vazios: quatro obrigatórios destacados, opcionais sem erro e sem enviar dados às APIs. Apresentação revisada por captura de tela. Sem necessidade de SQL, commit ou deploy nesta rodada.
## Teste inicial Basic de 30 dias

Novas organizações recebem teste gratuito Basic por 30 dias corridos a partir da criação da área do prestador. Ao atingir o instante de vencimento, o plano efetivo retorna ao Free. Não há contratação ou cobrança automática. Basic pago e Professional pago mantêm as regras existentes.

Duração centralizada em lib/provider-trial.ts. A expiração de teste usa data e hora exatas, separada da regra de calendário das cobranças Asaas. Textos do primeiro acesso, Soluções, Planos e Termos foram atualizados para 30 dias. Repetir a configuração do negócio não reinicia o teste. Organizações já cadastradas mantêm seus vencimentos anteriores; não houve extensão ou migração de registros.

Adicionado controle de plano no servidor para APIs de Clientes, Orçamentos, Agenda e Financeiro, para negar operações de gestão depois da expiração, inclusive com página previamente aberta. Os registros são preservados. Consultas e serviços públicos permitidos no Free mantêm seus limites existentes.

Validação: 45 testes aprovados, incluindo concessão exata de 30 dias, instante de expiração, apresentação do Free, bloqueio das quatro APIs, preservação de assinaturas pagas e regressão dos fluxos. TypeScript aprovado. Lint e build registrados após conclusão. Não exige novo SQL; efeito em produção depende da publicação da versão. Não houve commit, push ou deploy.
Fechamento da validação do teste Basic: build de produção aprovado; lint sem erros, com três avisos preexistentes de variável não usada em Clientes. Plano piloto atualizado para refletir o teste de 30 dias nos novos cadastros.

## 21/10/2026 — proteção persistente de recebimentos (etapa 1)
- API de baixa exige UUID e chama função transacional idempotente; não há fallback sem proteção.
- A aba mantém a chave ao perder a resposta/recarregar, até confirmação. Chave com dados diferentes é recusada.
- Migração: supabase/financeiro_recebimentos_idempotentes.sql. Aplicação VALLEX-Teste pendente do usuário; produção não alterada.
- 40 testes financeiros/fluxos passaram, incluindo repetição, conflito e rollback. TypeScript sem erros.
- Instruções: entregaveis/Aplicar_protecao_recebimentos_teste.md.
- Escopo: baixas em cobranças existentes. Cadastro inicial, abas com operações independentes, bloqueio de colaboradores e demais etapas continuam pendentes.


## 21/10/2026 — ordem do formulário de recebimento
- Nas duas entradas de recebimento, Parcela vem antes de Valor recebido, seguido por meio de pagamento e data.
- Selecionar parcela continua preenchendo o saldo integral, editável para recebimento parcial. Sem alteração de API ou SQL.


## 21/10/2026 — desativação e reativação de acesso da equipe
- Equipe: proprietário pode desativar/reativar colaborador com confirmação, sem excluir conta ou vínculo. Mantém permissões e vaga reservada.
- APIs de organização, clientes, orçamentos, agenda, financeiro, vitrine e suporte exigem vínculo ativo; novas atribuições na agenda também.
- SQL equipe_bloqueio_acesso.sql: is_active, função transacional restrita ao service_role com validação do proprietário, auditoria e política RLS restritiva de visibilidade de vínculo.
- Histórico e pagamentos devidos ao ex-colaborador preservados; atendimentos existentes não são redistribuídos automaticamente. Dados já carregados, operações já autorizadas e links de arquivos emitidos não são revogados retroativamente.
- TypeScript passou; lint sem erros (3 avisos preexistentes em Clientes). Testes PostgreSQL/RLS e API em tests/equipe-bloqueio.test.mjs, além de regressão dos fluxos de salvamento.
- Aplicação do SQL e teste com duas sessões no VALLEX-Teste pendentes do usuário. Instruções: entregaveis/Aplicar_bloqueio_colaboradores_teste.md. Sem commit ou deploy.


## 21/10/2026 — envio de convite pelo SMTP do Supabase
- Criação e renovação de convites solicitam Magic Link com retorno para a tela de aceite via signInWithOtp. Utiliza SMTP já configurado no Supabase; sem copiar credenciais Google para o app.
- E-mail de acesso funciona com contas novas e existentes; conta Auth pode ser criada, mas vínculo depende de aceite explícito. Falha de envio mantém convite e link manual e não informa entrega confirmada.
- Ajustar Redirect URLs e conferir template Magic Link conforme entregaveis/Validar_email_convite_Supabase.md. Sem novo SQL. Entrega real e retorno do e-mail pendentes de homologação; não foi enviado e-mail real pelo agente.


## 21/10/2026 — botão explícito de envio do convite
- Convites pendentes: gerar link e enviar por e-mail são ações separadas. Envio valida proprietário, organização, token vigente, validade e status pendente sem renovar/inutilizar o link.
- Botão Enviar convite por e-mail habilita após gerar link e mostra resultado. Bloqueia cliques simultâneos. Criação inicial mantém solicitação automática de envio. Sem SQL novo.


## 21/10/2026 — correção da porta no retorno do e-mail
- .env.development.local sobrescrevia NEXT_PUBLIC_SITE_URL com localhost:3001, divergindo de .env.local (3000). Corrigido para 3000. Reiniciar servidor local antes de novo envio.
- Tela de aceite agora explica erro de autenticação no retorno, sem apresentar a mensagem técnica ou dados sensíveis. Entrega confirmada pelo usuário; aceite completo ainda em homologação.


## 21/10/2026 — diagnóstico de proprietário e colaborador na mesma conta
- Consulta somente leitura confirmou convite aceito como member ativo e organização própria distinta para a mesma conta de teste. Nenhum vínculo/dado alterado no banco.
- Painel detecta conflito e informa que alternância não é suportada, em vez de abrir silenciosamente como proprietário. Aceite de novos convites recusa contas já proprietárias com mensagem específica.
- Decisão pendente: conta exclusiva de colaborador no piloto ou implementação completa de seleção de contexto em todas as APIs. Sem exclusões e sem SQL nesta correção.


## 21/10/2026 — ações da equipe e encerramento do vínculo
- Seleção de colaborador e ações Editar, Salvar/Cancelar, Desativar/Reativar, Excluir da equipe e Registrar pagamento no topo. Linhas mostram situação sem acumular botões.
- Novo colaborador em formulário recolhido; convites pendentes separados dos membros aceitos.
- DELETE exclusivo do proprietário chama remove_organization_member: snapshot auditável e exclusão apenas do vínculo, sem excluir conta/histórico. SQL equipe_exclusao_vinculo.sql pendente de aplicação em teste.
- Acessar painel após aceite revalida identidade, perfil member e organização aceita para impedir entrada com sessão trocada ou contexto incompatível. Conflito de conta já proprietária não é convertido silenciosamente em colaborador.
- Instruções entregaveis/Aplicar_exclusao_equipe_teste.md. Sem alterações de vínculos reais, commit ou deploy.


## 21/10/2026 — corrigido retorno indevido ao perfil proprietário após suspensão
- Vínculo de colaborador (incluindo inativo) tem precedência sobre organização própria nos contextos operacionais. Não altera owners nem exclui organizações.
- Proxy das APIs sistema revalida identidade/vínculo por requisição: inativo recebe MEMBER_DISABLED; ativo só pode chamar rotas operacionais com permissões verificadas pela própria rota. Equipe/configuração/cobrança da assinatura e outras ações de proprietário recusadas.
- Sem SQL novo. O servidor local precisa carregar proxy.ts. Escopo default do colaborador segue lib/team-permissions.ts, não permissões de proprietário.


## 21/10/2026 — homologação de acesso confirmada pelo usuário
- Usuário confirmou suspensão, mensagem de bloqueio, reativação e painel Vallex Business com perfil Colaborador e cards Orçamentos, Agenda e Suporte.
- Ajuste de apresentação: layout identifica MEMBER_DISABLED e mostra Acesso de colaborador desativado, sem encaminhar para planos.
- Card Suporte: removida borda amarela fixa; usa borda neutra e destaque violeta ao passar o mouse, alinhado aos demais cards. Amarelo de alertas e indicadores financeiros preservado. Efeito relatado na página pública ainda não identificado por captura específica.


## 21/10/2026 — nome da organização piscando no painel
- Causa: revalidação a cada 30 segundos e ao focar a aba sobrescrevia o nome validado com metadata.organization_name vazio, antes de buscar novamente a organização.
- Nome/atividade agora são atualizados pelo resultado da API. Metadados ficam limitados ao formulário de primeiro acesso, quando ainda não existe organização. A revalidação de bloqueios permanece ativa.


## 21/10/2026 — botões e retorno visual dos módulos testados
- Estilo global de ações: centralização horizontal/vertical e clareamento ao passar mouse; mantém foco por teclado e cores de estado.
- Clientes, Orçamentos, Agenda, Serviços e Vitrine: avisos de sucesso/erro fixos na área visível, acessíveis e com Fechar. Não depende de rolagem.
- Vitrine: Adicionar/Trocar imagem e Remover imagem com confirmação; remoção altera somente a referência da logo da própria organização via API, sem salvar outros campos ou apagar arquivos históricos do Storage.
- Upload/remoção bloqueiam ações concorrentes na interface. Sem SQL, sem publicação ou alteração de dados reais pelo agente.


## 21/10/2026 — confirmação da Vitrine junto à ação
- Salvar/publicar/revogar exibem o resultado imediatamente abaixo dos botões; trocar/remover logo exibe o resultado na Identidade visual. Sem aviso flutuante para essas ações e sem rolagem automática.


## 21/10/2026 — padrão de confirmação aprovado pelo usuário
- Usuário aprovou retorno local abaixo dos botões da Vitrine e pediu preservar o padrão para salvar/enviar/excluir e demais ações internas. Registrado em AGENTS.md para próximas implementações e revisões. Outros módulos ainda precisam de adequação individual; não considerados concluídos por este registro.


## 21/10/2026 — causa do bloqueio Netlify localizada no log
- Captura do usuário aponta ASAAS_WEBHOOK_TOKEN_SHA256 no cache binário .netlify/.next/cache/turbopack/...sst, não em linha de fonte versionada.
- npm run build passa a usar Next.js --webpack. prebuild remove apenas caches Turbopack gerados em .next e .netlify/.next, verificando contenção no diretório do projeto.
- Scanner permanece ativo; nenhum segredo ou escopo foi alterado. Sem isenção de chave/caminho. Banco e alterações paralelas de SQL preservados.


## 21/10/2026 — endereço do convite no preview Netlify
- Screenshot confirmou convite criado, mas envio não solicitado por falta de NEXT_PUBLIC_SITE_URL.
- Next config incorpora exclusivamente a URL pública do build: DEPLOY_PRIME_URL para preview/branch; URL explícita preservada em produção/local. Nenhuma chave é incorporada.
- Supabase ainda precisa autorizar https://deploy-preview-3--vallex.netlify.app/sistema/convites/aceitar** no projeto usado pelo preview. Convites existentes podem ser reenviados sem recadastrar colaborador.
