# Operação do módulo de tráfego pago

1. A migração `trafego_pago.sql` foi preparada para o **projeto Supabase de teste**. Não aplique em produção.
2. O módulo usa `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_ADMIN_USER_ID` no servidor.
3. Em `/admin/acessos`, o proprietário configura até duas pessoas, informando o e-mail que elas usarão no Supabase Auth. Os cadastros iniciais são placeholders sem usuário, senha ou credencial fictícia. Depois que a conta existir, salve o e-mail novamente, marque o acesso como ativo e salve.
4. Alexandre começa com acesso ao painel de tráfego: consultar dados, editar os três planos, acompanhar leads e registrar campanhas e indicadores. Suporte, prestadores e financeiro ficam desativados por padrão.
5. O proprietário pode configurar permissões de consulta, edição e exclusão por área. As opções do Financeiro ficam preparadas na matriz, mas este painel ainda não possui ferramentas financeiras administrativas para delegar.
6. O envio de formulário público gera leads com origem e parâmetros UTM quando disponíveis. Os números de campanha são preenchidos pela equipe; a integração automática com Google Ads ou Meta Ads não está incluída.

O valor cobrado pela gestão VALLEX fica separado do orçamento de mídia pago pelo cliente diretamente à plataforma de anúncios.
