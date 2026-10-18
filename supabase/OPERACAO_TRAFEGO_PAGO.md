# Operação do módulo de tráfego pago

1. A migração `trafego_pago.sql` foi preparada para o **projeto Supabase de teste**. Ela é idempotente e cria a tabela de histórico dos indicadores e os campos de Facebook/Instagram. Não aplique em produção.
2. O módulo usa `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_ADMIN_USER_ID` no servidor.
3. Antes de publicar a tela de cargos, aplique `equipe_cargos.sql` ao banco Supabase correspondente para adicionar a coluna de cargo aos acessos existentes.
4. Em `/admin/acessos`, o proprietário pode cadastrar os integrantes da equipe VALLEX sem limite fixo, informando nome, cargo, e-mail e permissões. Os cadastros iniciais são placeholders sem usuário, senha ou credencial fictícia. A pessoa cria sua conta pelo link interno de cadastro da equipe, sem configurar negócio ou vitrine. Depois, o proprietário verifica o vínculo, marca o acesso como ativo e salva.
5. Alexandre começa com acesso ao painel de tráfego: consultar dados, editar os três planos, acompanhar leads e registrar campanhas e indicadores. Suporte, prestadores e financeiro ficam desativados por padrão.
6. O proprietário pode configurar permissões de consulta, edição e exclusão por área. As opções do Financeiro ficam preparadas na matriz, mas este painel ainda não possui ferramentas financeiras administrativas para delegar.
7. O envio de formulário público gera leads com origem e parâmetros UTM quando disponíveis. Os números de campanha são preenchidos pela equipe; a integração automática com Google Ads ou Meta Ads não está incluída.
8. `/admin/trafego/resultados` apresenta a evolução registrada por campanha. Cada atualização manual dos indicadores acrescenta um ponto ao histórico; campanhas antigas recebem um ponto inicial com os valores atuais ao aplicar a estrutura atualizada.

O valor cobrado pela gestão VALLEX fica separado do orçamento de mídia pago pelo cliente diretamente à plataforma de anúncios.
