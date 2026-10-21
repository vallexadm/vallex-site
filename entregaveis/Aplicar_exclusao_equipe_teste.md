# Exclusão de colaborador da equipe — teste

1. Supabase → VALLEX-Teste → SQL Editor → New query.
2. Copiar e executar o arquivo inteiro `C:\vallex-site\supabase\equipe_exclusao_vinculo.sql`.
3. Esperado: Success. No rows returned. Se falhar, enviar mensagem sem executar em produção.
4. Atualizar Equipe. Selecionar colaborador no topo, testar Editar e Salvar/Cancelar. Conferir suspensão e reativação.
5. Com um colaborador de teste descartável, usar Excluir da equipe. Conferir confirmação, remoção da lista e liberação da vaga. Verificar registros anteriores de financeiro/agenda preservados e novas requisições do ex-colaborador recusadas.
6. Para retornar, enviar novo convite. Reativar é apenas para suspensão temporária; exclusão encerra vínculo.

Não exclui conta Auth, organizações próprias, convites aceitos, pagamentos nem agendamentos. Arquiva o vínculo e permissões na tabela organization_member_departures antes de remover o vínculo atual. Atendimentos pendentes permanecem para acompanhamento do proprietário. Recebimentos/gastos já registrados permanecem; o atalho de novo pagamento não existe para quem saiu da lista.

Novo colaborador fica em formulário recolhido separado. Convites aceitos não aparecem na lista de convites pendentes. Gerar/enviar/cancelar se aplicam somente aos pendentes.

O botão Acessar painel após aceite revalida a conta, organização e perfil member. Se a conta possuir organização própria e houver conflito, interrompe com mensagem em vez de abrir outro perfil. Alternância entre organizações continua fora do modelo atual; não foi removida nenhuma organização para resolver conflitos.
