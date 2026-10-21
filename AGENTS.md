<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Padrão de retorno das ações — ServiçoFácil

Preferência explícita do usuário, validada em 21/10/2026 na Vitrine:
- Para salvar, enviar, excluir, publicar, revogar e outras ações, apresentar sucesso ou erro junto ao botão/formulário que iniciou a operação, imediatamente abaixo das ações.
- Manter a posição de rolagem. Não exigir que a pessoa procure a confirmação no topo, nem substituir o retorno local por aviso flutuante em outro local.
- Usar o componente ActionNotice com inline quando aplicável, com mensagem clara, acessível e opção Fechar.
- Confirmações antes de ações destrutivas continuam separadas do resultado após a operação.
- Aplicar esse padrão em funcionalidades novas e ao revisar módulos existentes. A aprovação da Vitrine não significa que todos os módulos já foram adaptados.
