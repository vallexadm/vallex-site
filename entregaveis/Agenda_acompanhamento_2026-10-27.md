# Agenda e acompanhamento — 27/10/2026

## O que foi implementado
- Inicio e termino obrigatorios em novos agendamentos; intervalo posterior opcional (0 a 240 minutos).
- Reserva atomica por profissional no PostgreSQL, inclusive entre organizacoes: nao permite sobreposicao de Confirmado, Em deslocamento, Cheguei ao local e Em atendimento. Concluido, Cancelado e Cliente ausente liberam o periodo.
- Registros antigos sem termino ocupam 60 minutos para verificacao; nenhum horario e alterado automaticamente. A migracao aborta integralmente se encontrar sobreposicoes antigas.
- Remarcacao/troca de responsavel com motivo, historico e controle de versao para nao sobrescrever outra tela. Retorna a Confirmado e limpa a previsao anterior de chegada.
- Ordem cronologica com filtros Hoje, Proximos, Todos e profissional; a lista nao remarca automaticamente por atraso.
- Responsavel atribuido pode atualizar andamento e previsao manual. Gerenciamento e compartilhamento continuam sujeitos as permissoes da agenda.
- Aviso quando chegada manual + duracao prevista + intervalo alcançam o proximo compromisso conhecido desse profissional.

## Como o cliente acompanha
1. Gestor abre o atendimento e escolhe Gerar / renovar link do cliente.
2. Copia o link e envia manualmente ou abre o WhatsApp para escolher o destinatario e enviar. Nada e enviado automaticamente.
3. Cliente abre no navegador, sem conta. Mostra empresa, horario, situacao, previsao manual e ultima alteracao. Atualiza a cada 30 segundos quando a aba esta visivel.
4. Sem GPS, mapa ou localizacao exata; nao mostra cliente, telefone, endereco, titulo livre, notas, equipe ou demais compromissos.
5. Renovar invalida o anterior; Desativar link bloqueia o acompanhamento. Validade exibida ao gerar: sete dias apos o maior entre agora e termino, limitada a 90 dias. Remarcacao nao estende link antigo; conferir validade.

Token aleatorio de 256 bits, somente SHA-256 no banco. Token fica no fragmento do link e e enviado no corpo da consulta; respostas sem cache e pagina noindex/no-referrer. Qualquer pessoa que receber o link pode consultar os campos limitados ate expirar/revogar.

## Publicacao
1. Fazer backup atual dos ambientes e guardar fora do repositorio. Backup de 23/10 nao representa alteracoes posteriores.
2. Aplicar supabase/agenda_acompanhamento_conflitos.sql primeiro no VALLEX-Teste; se falhar com AGENDA_EXISTING_CONFLICTS, usar agenda_diagnostico_conflitos.sql para revisar com o responsavel. Nao cancelar nem alterar compromissos automaticamente.
3. Homologar preview com proprietario, membro atribuido, outra organizacao e link em navegador separado.
4. Confirmar nova reserva, choque de horarios simultaneo, intervalo, remarcacao, historico, situacoes, estimativa, expiracao/renovacao/desativacao de link.
5. Aplicar migracao de producao e so entao publicar o codigo. Publicar antes quebra o GET da agenda antiga por falta das novas colunas.
6. Apos uso de novas situacoes, uma reversao para codigo antigo exige compatibilidade com esses estados. Nao reverter cegamente nem apagar colunas/dados de historico.

## Limites desta entrega
Cliente acompanha um atendimento previamente criado na agenda; agendamento publico de novos horarios pela vitrine ainda nao foi implementado. Nao ha estimativa por rota, localizacao em tempo real, mensagens automaticas nem aviso push. A previsao manual nao move reservas: atrasos reais exigem que o prestador combine e registre a remarcacao.

## Validacao
33 testes Node (estados, autorizacao, privacidade, versao, vinculo, planos e regressao) passaram. 14 cenarios em PostgreSQL 17.6 real passaram, incluindo duas conexoes concorrentes, sobreposicao, intervalo, adjacencia, profissionais distintos, mesmo profissional entre organizacoes, cancelamento, historico/versao, legado sem termino, privacidade de tabelas, reaplicacao e rollback por conflito legado. Lint e tipos aprovados; build webpack concluiu 77 paginas. Os testes usam dados ficticios em container sem rede e sem portas publicadas; nenhuma migracao aplicada em Supabase ou alteracao em atendimento real nesta entrega.
