# Redesign 3.0

Interface integrada em 26/11/2026 após aprovação dos protótipos. Não houve commit ou deploy automático.

## Interface atual

- Light/dark com verde-oliva, superfícies opacas e foco visível.
- Cabeçalho desktop com marca à esquerda, menu centralizado e tema/conta à direita; navegação compacta no mobile.
- Início com Santa Cecília, autenticação com ambientação responsiva e missa com faixa conforme o tempo litúrgico conhecido.
- Catálogo com busca/lista e leitor separado; retorno preserva filtros e busca.
- Repertório ativo em painel lateral no desktop e inferior no mobile, com Escape e restauração de foco.
- Tom, letra, fonte, vídeo, impressão e apresentação mantidos; inclusão de músicas conserva a ordem de adição.
- Administração com navegação responsiva, ações no fluxo e prévias antes de confirmação.

Better Auth, autorizações, direitos musicais, revisão editorial, snapshots públicos, privacidade e controle de concorrência foram preservados.

## Recursos visuais

Arquivos usados pelo site em `public/images/`; originais fornecidos em `imagens/`. [Créditos e licenças](image-credits.md) e [manifesto de origem, dimensões e hashes](image-assets.json). Os cinco originais de procedência pendente não são publicados.

Os protótipos HTML, galerias, capturas, cópias de imagens e ferramentas exclusivas da revisão foram removidos após a integração. A aplicação não depende desses arquivos.

## Validação da integração

Registro da revisão anterior à limpeza: 1.472 testes aprovados em 103 arquivos, lint, TypeScript e build; 376 capturas em 320/360/390/1440 px e light/dark; 188 avaliações axe sem violações encontradas e 13 cenários de interação aprovados.

O QA utilizou dados e contas fictícios em banco descartável. Viewport reduzido não substitui teclado nativo, VoiceOver/TalkBack e avaliação em aparelhos reais. O player foi simulado; Facebook e Resend reais não foram acionados.

Após a limpeza e correção do cabeçalho: 1.469 testes aprovados em 102 arquivos (três testes do componente oculto removido deixaram de ser necessários), lint, TypeScript e build sem erros. O cabeçalho foi conferido diretamente na aplicação local em 320/390/768/1024/1280/1440/1920 px, light/dark, incluindo centralização do menu, ausência de sobreposição e abertura/fechamento da conta pelo teclado. As 27 variantes WebP e os dez originais locais foram conferidos por hash. Não exige variáveis novas na Vercel.
