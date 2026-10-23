# Plano piloto VALLEX ServiçoFácil para 10 a 20 prestadores

Versão 1.0 — 21 de outubro de 2026

## 1 Objetivo e decisão esperada

Executar um piloto acompanhado para verificar se prestadores conseguem divulgar o negócio, receber solicitações, preparar orçamentos e registrar atendimentos e finanças com confiança. Começar com 10 organizações e admitir mais duas turmas de 5 somente quando os critérios de avanço forem cumpridos.

O resultado será uma decisão documentada de ampliar, manter o grupo ou corrigir antes de crescer. Vinte prestadores é o tamanho máximo deste piloto, não uma capacidade simultânea já comprovada do sistema. Clientes cadastrados, colaboradores e visitantes são contados separadamente.

Este plano organiza o trabalho; não inicia convites, cobranças, alterações no banco ou testes de carga.

## 2 Participantes e recorte

Selecionar inicialmente 10 prestadores que já recebam demandas e possam registrar atendimentos durante quatro semanas. Preferir uma região onde a VALLEX consiga acompanhar o uso. Goiânia e entorno são um recorte proposto, sujeito à rede de contatos disponível.

Composição sugerida da primeira turma:

| Perfil | Quantidade | O que observar |
|---|---:|---|
| Informática e assistência técnica | 4 | Pedido, diagnóstico, orçamento e histórico |
| Elétrica, redes e manutenção | 4 | Visita, custos, agenda e recebimentos |
| Outros serviços com dinâmica semelhante | 2 | Clareza do fluxo e diferenças de linguagem |

Incluir pelo menos dois pequenos negócios com colaborador, pessoas com menor familiaridade digital e usuários que trabalhem principalmente pelo celular. Evitar, nesta rodada, segmentos que dependam de módulos ainda planejados ou regras profissionais ainda não revisadas.

Critérios de entrada: interesse voluntário, contato para suporte, disponibilidade para orientação inicial de 30 a 45 minutos e uma conversa semanal de 15 minutos, além de uma expectativa de pelo menos três oportunidades reais durante o período. Não prometer novos clientes, faturamento ou volume de pedidos.

Reservar cinco candidatos para a segunda turma e cinco para a terceira. Convite e contato externo ficam com a pessoa responsável da VALLEX; mensagens não são enviadas por este planejamento.

## 3 Condição de participação

Proposta comercial para o piloto: acesso às funcionalidades combinadas por 30 dias, sem contratação ou cobrança automática. Confirmar por escrito o início, o término, os módulos disponíveis, o suporte e as condições de saída antes do cadastro.

O código do primeiro acesso foi atualizado para conceder 30 dias corridos de teste Basic a novas organizações. Ao vencer, o acesso efetivo retorna ao Free, sem cobrança automática. Antes do piloto, homologar essa regra e conferir a versão publicada. Contas criadas anteriormente mantêm os vencimentos que já receberam; sua participação exige conferência individual do período disponível. Não cadastrar cartão nem gerar assinatura real apenas para liberar o piloto.

Ao término, apresentar a oferta comercial separadamente. Contratação depende da escolha expressa do prestador. Definir previamente como consultar e exportar os próprios registros após o encerramento do acesso temporário.

## 4 Preparação obrigatória antes de receber participantes

O Dia 0 só será marcado quando esta etapa estiver concluída. Se uma dependência externa atrasar, deslocar o início; não reduzir a validação para cumprir uma data.

| Item | Entrega verificável | Responsável proposto |
|---|---|---|
| Fluxos principais | Lista de aceite por módulo, com problemas bloqueantes corrigidos ou módulo explicitamente fora do piloto | Produto e desenvolvimento |
| Versão e ambientes | Commit candidato identificado, preview revisado e banco de homologação separado da produção | Desenvolvimento e operação |
| Migrações | Conferir quais scripts já foram aplicados; validar somente os pendentes em VALLEX-Teste antes de produção | Operação técnica |
| Acesso e planos | Proprietário e colaborador autorizados; organização B não acessa dados da A; expiração e benefícios testados no servidor | Desenvolvimento |
| Financeiro | Parcial, quitação, edição, repetição de envio e recuperação após falha testados; lançamento ambíguo tem procedimento de conferência | Desenvolvimento e suporte |
| Recuperação | Backup conferido e restauração ensaiada em ambiente separado; roteiro de reversão da aplicação | Operação técnica |
| Transparência | Condições do piloto, dados públicos e privados, canal de suporte e regras de saída apresentados | Produto e operação |
| Monitoramento | Erros, latência, consumo e eventos críticos consultáveis, sem senhas ou dados pessoais desnecessários em logs | Desenvolvimento e operação |
| Carga inicial | Cenários sintéticos graduais aprovados em ambiente representativo | Desenvolvimento |
| Atendimento | Pessoa responsável, horários e registro de chamados definidos | Suporte VALLEX |

Correções locais já relatadas não comprovam publicação ou migração no banco ativo. O status de cada item deve ser confirmado no início da execução.

Idempotência persistente de recebimentos, consistência das regras de plano nas APIs e revogação de acesso de colaborador são itens de confiança a resolver antes de liberar os fluxos correspondentes para uso real. Se não estiverem prontos, manter o cenário em homologação com dados fictícios e não apresentá-lo como operação aprovada.

## 5 Segurança de capacidade como prioridade de preparação

Após consolidar os fluxos, priorizar paginação do financeiro, redução das consultas individuais de planos e equipe, revisão de índices e cache somente de dados públicos apropriados. Acrescentar limites de frequência e proteção de formulários públicos, monitoramento e critérios de aumento de recursos.

Executar carga somente em ambiente autorizado, separado, com dados fictícios e integrações financeiras de teste. Confirmar que preview e aplicação de carga não apontam para banco ou credenciais reais por engano.

Roteiro inicial proposto: 10, depois 20 e depois 40 usuários virtuais ativos, com 5 minutos de aquecimento e 20 minutos de observação em cada etapa aprovada. Distribuição de referência: 50% prestadores, 10% colaboradores, 35% visitantes/clientes e 5% administração. Documentar ações, pausas de uso, volume de dados, plano de infraestrutura e configuração. Visita pública não precisa de conta autenticada.

Esses números são cenários de teste, não previsões de capacidade. Alternar pesquisa pública, abertura de solicitação, consulta financeira e gravações permitidas. Comparar resultados antes e depois das otimizações; medir falhas funcionais e integridade, além de velocidade.

Metas iniciais propostas: 95% das consultas principais em até 3 segundos; 95% das gravações em até 5 segundos; menos de 1% de falhas inesperadas nas operações válidas; zero acesso indevido, perda ou duplicação de lançamento. Registrar tamanho da amostra e aquecimento. Rejeições de validação intencionais não são falhas, mas erros inesperados de autenticação ou autorização são. Se uma etapa falhar, interromper a progressão e corrigir.

Para chamar uma faixa de carga de sustentada, repetir o ensaio relevante sem regressão e manter margem de recursos para picos. Até isso ocorrer, informar capacidade como não medida. Acompanhamento do piloto real complementa, mas não substitui, teste de carga.

## 6 Cronograma de quatro semanas

| Período | Prestadores | Atividades e saída |
|---|---:|---|
| Preparação | Equipe interna | Cumprir os critérios da seção 4 e selecionar candidatos |
| Semana 1 | 10 | Orientar, publicar vitrines e acompanhar a primeira jornada; observar sem automatizar crescimento |
| Semana 2 | Até 15 | Admitir cinco somente após o primeiro aceite; corrigir dificuldades recorrentes e acompanhar suporte |
| Semana 3 | Até 20 | Admitir mais cinco se o segundo aceite passar; acompanhar dias e horários de maior uso |
| Semana 4 | Até 20 | Consolidar resultados, entrevistar participantes, conferir indicadores e decidir continuidade |

Quem entrar na segunda ou terceira turma também recebe o período acordado de acompanhamento. A conclusão da semana 4 produz o primeiro relatório; a avaliação final dessas turmas ocorre após completarem seu período individual. Não comparar retenção de participantes com tempos de exposição diferentes.

## 7 Orientação inicial e tarefas de cada prestador

Na sessão inicial, registrar o perfil e as tarefas que o profissional precisa realizar. Orientar a criação da organização, contato público, região, um a três serviços e revisão da vitrine. Demonstrar a diferença entre orçamento aprovado internamente, aceite do cliente, serviço concluído e pagamento recebido.

Cada participante executa primeiro uma jornada com dados fictícios em homologação. Após aceite e entrada no ambiente operacional, passa a usar dados reais apenas nos fluxos liberados. Não manter lançamentos fictícios misturados aos relatórios do negócio.

Roteiro mínimo:

1. Entrar, sair e recuperar acesso.
2. Revisar e publicar vitrine; confirmar serviço, contato e região.
3. Receber pedido, identificar cliente e preparar orçamento.
4. Compartilhar proposta pelo canal existente, sem tratar abertura de WhatsApp como prova de envio ou aceite.
5. Registrar resposta do cliente e organizar atendimento nos recursos efetivamente disponíveis.
6. Registrar cobrança, entrada e parcelas; receber somente a primeira parcela e conferir o saldo restante.
7. Registrar despesa e, quando aplicável, selecionar colaborador. Não repetir como despesa geral um custo já contabilizado no serviço.
8. Consultar relatório, localizar histórico e abrir chamado de suporte.

Cliente avulso é opção para registro pontual sem identificação individual. Para cobrança, retorno e histórico de uma pessoa específica, usar cadastro identificado.

Cada prestador deve registrar ao menos três oportunidades reais, se elas ocorrerem naturalmente. Em pelo menos uma, acompanhar o desfecho. Ausência de demanda deve ser registrada como tal, sem criar atendimento ou contratação fictícios para cumprir meta. Uma simulação de jornada pode suprir a observação de usabilidade, mas não entra no indicador de negócio real.

## 8 Responsabilidades e rotina

| Papel | Responsabilidade |
|---|---|
| Liderança de produto VALLEX | Selecionar participantes, confirmar escopo e decidir avançar, manter ou interromper |
| Desenvolvimento | Corrigir código, manter testes, analisar métricas e preparar versões revisáveis |
| Operação técnica | Conferir ambientes, migrações, backups e implantação autorizada |
| Suporte VALLEX | Orientar, registrar incidentes, confirmar retorno e acompanhar resolução |
| Prestador | Usar os fluxos combinados, conferir registros e comunicar problemas |

Uma pessoa pode acumular papéis; ainda assim, registrar o nome de quem responde por cada função antes do Dia 0. O assistente apoia análise, código e documentação; ações externas dependem de ferramentas e acessos disponíveis.

Rotina proposta para a VALLEX: revisão diária de 20 minutos para erros e chamados; dois horários de suporte combinados em dias úteis; revisão técnica de 30 minutos duas vezes por semana; reunião de decisão semanal de 45 minutos. Somar o tempo real de orientação e suporte por participante para avaliar se a operação é sustentável.

Proposta de atendimento: acusar recebimento de problema comum em até um dia útil. Incidente crítico identificado dentro do horário combinado exige triagem imediata e contato com os afetados. Isso é uma meta operacional a confirmar com a equipe, não suporte ininterrupto ou garantia de resolução nesse prazo.

## 9 Métricas e critérios para admitir a próxima turma

As metas abaixo são propostas de gestão do piloto. Contagens e depoimentos de um grupo pequeno orientam decisões, mas não comprovam demanda de todo o mercado.

| Indicador | Como medir | Critério de avanço proposto |
|---|---|---|
| Configuração | Prestadores que concluíram vitrine e serviço / participantes com pelo menos três dias de acesso | Pelo menos 80% |
| Uso recorrente | Prestadores com ação útil em dois dias distintos / participantes com uma semana completa | Pelo menos 70%; abrir página não basta |
| Jornada observada | Prestadores que concluíram o roteiro liberado em uso real ou simulação identificada | Pelo menos 80%; separar real e simulado |
| Integridade e acesso | Incidentes de perda, duplicação e acesso indevido | Zero incidente crítico aberto |
| Estabilidade | Falhas inesperadas e latência nas operações medidas | Metas da seção 5; registrar amostra e período |
| Dificuldades | Tarefas que exigem intervenção da VALLEX | Nenhum bloqueio recorrente sem solução ou alternativa documentada |
| Satisfação | Nota de 1 a 5 e principal dificuldade | Média mínima proposta de 4; informar quantos responderam |
| Operação | Tempo gasto em suporte e pendências por turma | Equipe confirma capacidade de absorver mais cinco |

Somente avaliar avanço após uma semana completa da turma inicial e pelo menos três dias úteis consecutivos sem incidente crítico aberto. Poucos dados, falha em critério ou dúvida sobre integridade levam a manter a turma, não a concluir aprovação por ausência de reclamações. O responsável registra resultado de cada indicador e a decisão.

## 10 Incidentes e proteção dos participantes

Classificar como crítico: exposição de dados entre organizações, perda de registros, divergência financeira sem explicação ou indisponibilidade do fluxo essencial sem alternativa. Nesses casos, suspender novas entradas e bloquear o fluxo afetado, preservar evidências e verificar a necessidade de retorno à versão anterior. Não apagar lançamentos para esconder um problema.

Falha funcional com alternativa é alta prioridade; dificuldade de texto ou organização sem perda de função é melhoria. Registrar impacto, versão, conta de teste ou identificador do caso, horário, passos, responsável e resultado. Não incluir senhas ou tokens no chamado.

Depois de corrigir, reproduzir o cenário em homologação, testar regressão e confirmar o resultado com o participante antes de encerrar o chamado. Comunicações a clientes e prestadores são feitas pelo responsável da VALLEX, com informação concreta sobre o impacto.

## 11 Custos e avaliação de sustentabilidade

Antes de iniciar, levantar plano e consumo atual de Netlify e Supabase, armazenamento, serviços de comunicação e custos efetivos de cobrança, se aplicáveis. Registrar o custo incremental do piloto e estabelecer um teto interno de gasto e alertas. Este plano não presume valores contratados ou autoriza compras.

Calcular semanalmente custo de infraestrutura por organização ativa e tempo de suporte por participante. No fechamento, comparar esses valores com a proposta comercial, a recorrência de uso e a disposição declarada de continuar. Separar receita de assinatura de serviços pontuais da VALLEX. Não apresentar o acesso gratuito como receita ou a intenção de contratação como venda concluída.

## 12 Entregas para executar e encerrar

Manter cinco registros simples: lista de participantes e datas; checklist de orientação; diário de uso e métricas; fila de incidentes; ata das decisões semanais. Podem começar como documentos ou planilhas, sem desenvolver um módulo novo para gerir o piloto.

Ficha mínima do participante: código P01 a P20, negócio, segmento, responsável, data de entrada, versão/ambiente, módulos liberados, término do acesso e situação. Dados de contato ficam no cadastro restrito de operação, sem divulgação no relatório geral.

Ficha mínima do chamado: código, participante, módulo, impacto, passos, resultado esperado/observado, horário, versão, responsável, situação e evidência da correção.

Relatório final: participantes efetivamente acompanhados, exposição de cada turma, jornadas reais e simuladas, métricas com denominadores, incidentes, custo/tempo de suporte, melhorias priorizadas e decisão. O próximo grupo só recebe convite depois dessa decisão, quando depender de nova ampliação.

## 13 Primeiras ações

1. Confirmar responsáveis por produto, operação e suporte.
2. Revisar a lista de pendências e concluir os fluxos necessários ao piloto.
3. Confirmar migrações, versão candidata e separação dos ambientes.
4. Executar as medidas de capacidade e os testes graduais de preparação.
5. Formalizar os 30 dias de participação e a concessão temporária de acesso.
6. Selecionar os dez primeiros candidatos e agendar a orientação.
7. Registrar o Dia 0 somente depois do aceite de preparação.

Base de planejamento: varredura dos módulos e registro local de ajustes do ServiçoFácil consultados nesta conversa. Datas de lançamento, participantes, responsáveis nominais, orçamento e capacidade simultânea serão definidos na execução; não são resultados já confirmados.
