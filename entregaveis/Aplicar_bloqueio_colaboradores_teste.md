# Bloqueio de colaboradores — VALLEX-Teste

1. No Supabase, selecione **VALLEX-Teste** e abra **SQL Editor → New query**.
2. Abra `C:\vallex-site\supabase\equipe_bloqueio_acesso.sql` no VS Code.
3. Copie o conteúdo completo para o SQL Editor e clique **Run**. O esperado é **Success. No rows returned**.
4. Se houver erro, envie a mensagem. Não aplique na produção.
5. Atualize o sistema local, conectado ao teste. Entre como proprietário e abra **Equipe**.
6. Com uma conta de colaborador de teste já aberta em outro navegador, use **Desativar acesso** no proprietário e confirme.
7. No navegador do colaborador, tente atualizar Clientes, Orçamentos, Agenda e Financeiro. O servidor deve recusar o vínculo; não basta verificar apenas o menu. Dados que já estavam na tela não são apagados remotamente.
8. Confira no proprietário que histórico, recebimentos e atendimentos continuam existentes. O desativado não deve ser opção para novos agendamentos. Pagamentos devidos ao ex-colaborador continuam permitidos no Financeiro.
9. Use **Reativar acesso** e confirme que o colaborador recupera suas permissões anteriores ao atualizar a página.

O vínculo permanece cadastrado e continua ocupando vaga no plano. Não há exclusão da conta, reatribuição automática de atendimentos nem remoção de histórico. O proprietário deve acompanhar os atendimentos pendentes. O bloqueio vale nas novas verificações do servidor; requisições já autorizadas antes da desativação podem terminar. A sessão global do usuário não é revogada, pois ele pode usar outras áreas da plataforma. Links de arquivos já emitidos precisam de revisão própria de prazo/revogação.

A migração adiciona is_active=true para vínculos existentes e registra alterações de acesso em organization_member_access_logs. Não desativa ninguém automaticamente. Aplicar antes de utilizar a nova versão local; sem a coluna, consultas que verificam o vínculo falham de forma fechada.

Não houve aplicação em produção, commit ou deploy nesta etapa.
