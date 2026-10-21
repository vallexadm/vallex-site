# Proteção de recebimentos — homologação

1. No Supabase, selecione **VALLEX-Teste**. Confira o nome antes de executar.
2. Abra **SQL Editor → New query**.
3. No VS Code, abra `C:\vallex-site\supabase\financeiro_recebimentos_idempotentes.sql`.
4. Copie o arquivo inteiro, cole no SQL Editor e clique **Run**.
5. O resultado esperado é **Success. No rows returned**. Se houver erro, envie a mensagem; não execute na produção.
6. No projeto local conectado ao VALLEX-Teste, atualize a página Financeiro.
7. Em uma cobrança de teste de R$ 1.000 com duas parcelas de R$ 500, receba apenas R$ 100 da primeira parcela. Confira um recebimento, R$ 400 restantes na primeira e R$ 500 na segunda.
8. Confira que um novo recebimento intencional de mais R$ 100 funciona, sem quitar o restante.

O SQL cria uma tabela técnica e uma função transacional, sem modificar recebimentos anteriores. A função anterior permanece para o cadastro inicial de cobrança. A nova API de baixa exige esta migração; sem ela, exibe indisponibilidade e não usa um caminho sem proteção.

A chave permanece na aba enquanto a resposta não for confirmada, inclusive ao recarregar. Após confirmação, a próxima baixa recebe uma nova chave. Abas ou dispositivos diferentes geram operações independentes; permanecem sujeitos aos limites de saldo do banco. Esta etapa não identifica duas baixas intencionais como sendo o mesmo pagamento externo e não inclui idempotência do recebimento inicial ao criar uma cobrança.

Antes de qualquer deploy, aplicar e validar no teste. Produção, commit e Netlify Preview ainda pendentes.
