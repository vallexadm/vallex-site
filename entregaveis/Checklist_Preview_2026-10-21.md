# Entrega ServiçoFácil — 21/10/2026

Inclui convites por e-mail com aceite, escopo e suspensão/reativação/exclusão do colaborador, Basic inicial de 30 dias, validação de formulários, recebimentos parciais/idempotência, cliente avulso, gastos de colaboradores e ajustes visuais e de mensagens.

Validação local: 99 testes automatizados passaram e build Next.js --webpack concluiu com 75 páginas e Proxy.

## Banco do ambiente usado no preview
Conferir/aplicar, na ordem, se ainda faltarem:
1. supabase/organization_invitation_contact.sql e permissoes_colaboradores.sql (pré-requisitos anteriores).
2. supabase/financeiro_correcao_edicao_parcelas_recebidas.sql (pressupõe financeiro_edicao_historico.sql já existente).
3. supabase/financeiro_cliente_avulso_colaborador.sql.
4. supabase/financeiro_recebimentos_idempotentes.sql.
5. supabase/equipe_bloqueio_acesso.sql.
6. supabase/equipe_exclusao_vinculo.sql.
7. supabase/asaas_plan_payment_methods.sql (para checkout PIX/boleto; manter Sandbox na homologação).

Não executar schema-production.sql inteiro: é referência de estrutura. As migrações não são aplicadas automaticamente pelo deploy. Não houve migração de produção nesta entrega.

## Netlify/Supabase
- Preview deve usar as variáveis do banco VALLEX-Teste; não misturar URL e chaves de projetos distintos.
- NEXT_PUBLIC_SITE_URL do preview deve ser o endereço acessível dessa versão, nunca localhost. Arquivos .env locais não são enviados.
- Autorizar o endereço de retorno /sistema/convites/aceitar** em Authentication → URL Configuration no Supabase correspondente.
- SMTP Google Workspace e modelo Magic Link em português são configurações externas ao Git. Preservar {{ .ConfirmationURL }}.
- Testar conta nova de prestador (30 dias), convite em outro navegador, aceite, permissões, bloqueio/reativação, recebimento parcial e Vitrine.
- Produção depende da conferência das migrações e variáveis próprias, seguida de promoção deliberada do preview aprovado.

Limites conhecidos: não há seletor de organizações; vínculo de colaborador prevalece sobre organização própria enquanto existir. Exclusão de imagem remove referência na Vitrine, sem limpeza dos arquivos históricos no Storage. Mensagens locais aprovadas na Vitrine; demais módulos ainda em revisão desse padrão. Capacidade/carga e demais itens do plano piloto continuam pendentes.
