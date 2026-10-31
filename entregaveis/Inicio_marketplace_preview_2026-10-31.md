# Página inicial em formato de catálogo — preview de teste

Implementação autorizada em 31/10/2026. Disponibilizar apenas no PR #6, sem merge em main ou publicação em produção.

## Resultado
- Página inicial com busca, categorias, filtros por região e atendimento e ordenação alfabética.
- Vitrines reais já publicadas do Supabase de teste. Perfis privados, prévias e serviços não publicados são excluídos.
- Menu lateral modal em todas as páginas públicas que usam Header, reaproveitando integralmente config/site.ts, incluindo as seis opções de Serviços.
- Escape, fechamento por clique externo, foco contido pelo dialog nativo e retorno ao botão de abertura.
- Links de login, cadastro e administração mantidos. Cadastro, autenticação, assinaturas, APIs e banco sem alterações nesta entrega. Nenhuma migração nova.
- Conteúdo das outras páginas e âncoras preservados.
- Estilos isolados em CSS Module, com ajustes para computador e celular.
- Banner com imagem decorativa gerada por IA, sem atribuição aos prestadores cadastrados. Cartões usam logos reais e identificação textual quando não existe logo; não foram adicionados anúncios fictícios.

## Ambiente
Compilação e validação local com variáveis de .env.development.local e verificação explícita do projeto mgncqwztoeulufetgfoc. Não utilizar .env.local sem sobrepor as variáveis de teste.

## Validação
26 testes passaram, incluindo filtros e exclusão de perfis privados e testes existentes de acesso. TypeScript, ESLint e build webpack aprovados. Navegação local conferida: busca do topo, categoria vazia, limpar filtros, menu com Escape e retorno de foco, link Planilhas automatizadas e âncora existente, responsividade móvel. Preview remoto deve ser confirmado após o deploy.

## Arte da capa
Arquivo final: public/images/marketplace-profissionais.webp (1800 × 600, aproximadamente 77 KB).
Ferramenta: ImageGen integrada. Prompt final:

Create an ultra wide 3:1 photorealistic editorial banner photograph for a Brazilian local services marketplace. NO TEXT, NO LOGOS, NO LETTERS, no badges. Three friendly real-looking Brazilian adult service professionals side by side on RIGHT TWO THIRDS: woman cleaner holding cloth and spray bottle, man maintenance technician navy polo holding drill safely, woman real estate professional with tablet. Natural inclusive appearance, professional without exaggerated posing, waist up, authentic Brazilian home bright warm interior soft background. LEFT THIRD smoothly fades to solid deep dark purple #17002e, suitable for overlay text in website, ample negative space. Navy uniforms and muted purple accents. Premium website hero photography, warm approachable daylight, realistic hands, clean concise composition. This is generic decorative image and should not resemble an actual named service business or endorsement. Wide landscape banner, no frames.
