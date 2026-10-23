# E-mail de convite — VALLEX-Teste

O convite da equipe agora solicita ao Supabase um e-mail de acesso (Magic Link), usando o SMTP já configurado. Funciona para contas novas e existentes. Conta nova pode ser criada no Auth; o vínculo só é efetivado após o aceite explícito e as verificações da API. Não é necessário fornecer a senha SMTP ao projeto.

## Conferir no Supabase do ambiente de teste
1. Authentication → URL Configuration: autorizar `http://localhost:3000/sistema/convites/aceitar**` em Redirect URLs. Se o servidor estiver em 3001, cadastrar a URL dessa porta também.
2. A variável local NEXT_PUBLIC_SITE_URL deve corresponder à origem utilizada no teste. Reiniciar npm run dev se alterar variáveis. Não trocar URL de produção por localhost.
3. Authentication → Email Templates → Magic Link: o botão precisa usar `{{ .ConfirmationURL }}` para validar a sessão e retornar ao convite. Um template que apresenta somente código OTP não atende a esta tela; preserve uma cópia antes de editar. O template é compartilhado com os demais acessos por Magic Link.
4. Criar convite de teste na Equipe. O resultado informa se o Supabase aceitou a solicitação ou recusou o envio. Aceitação não comprova entrega na caixa postal.
5. No e-mail, abrir o link no mesmo computador para localhost. Confirmar que retorna à tela de aceite com a conta correta, aceitar e testar o acesso.
6. Testar também conta já cadastrada e renovação do convite pendente. Ao renovar, o token anterior da equipe deixa de valer.
7. Se não chegar: Authentication → Logs e logs do SMTP Google Workspace. Enviar apenas a mensagem do erro, sem chaves ou links de autenticação.

O link de autenticação tem validade e limites de envio próprios do Supabase; o convite da equipe tem validade separada. Abrir o e-mail não insere automaticamente a pessoa na organização. O aceite continua obrigatório. Antes de usuários externos, usar URL acessível do preview e autorizar essa URL de retorno. Sem aplicação SQL nesta etapa.
