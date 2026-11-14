# Repertório Web — Referências visuais aprovadas (Etapa 2E.4A)

## Arquivos
- `logo-santa-cecilia-original.png` — identidade real do Grupo de Canto Santa Cecília, enviada pelo usuário. É a referência de cores e ilustração. **Não substituir por desenho gerado**, não distorcer, preservar créditos e os elementos da marca.
- `referencia-01-inicio-preparar-missa.png` — tela-alvo para Início e preparação de Missa (mockup 1448×1086).
- `referencia-02-catalogo-leitor.png` — tela-alvo para Catálogo, leitura de cifra e repertório em construção (mockup 1448×1086).

## Objetivo
Reproduzir a aparência, proporções, hierarquia e linguagem das duas referências **dentro da aplicação Next.js existente**, sem reconstruir a aplicação e sem trocar os contratos MongoDB/API. A interface deve ser funcional, acessível e responsive. A referência prevalece sobre preferências estéticas anteriores quando não compromete usabilidade ou dados reais.

## Características visuais obrigatórias
- Estética sacra e musical discreta; pergaminho/marfim quente, oliva profundo, castanho, dourado de apoio. Evitar look ERP/dashboard, gradientes fortes, brilho, cartões excessivamente repetidos e ornamentos excessivos.
- Cabeçalho oliva escuro, marca à esquerda, quatro entradas principais (Início, Missa, Catálogo, Repertórios), pesquisa em destaque, Conta à direita. Mobile: compactação e barra inferior já existente, se útil.
- Títulos em serifa elegante (respeitar Fraunces existente, se adequado); textos de interface sans-serif legível; contraste WCAG AA; tamanhos mínimo 14px na maioria dos elementos interativos.
- Superfícies marfim, bordas bege muito suaves e raios moderados; áreas bem divididas, *sem* competir igualmente na atenção.
- Santa Cecília como ilustração decorativa recortada ou exibida preservando proporções, nunca texto completo do logo comprimido em tamanho ilegível. Se for extraído um recorte, derivar exclusivamente do arquivo original, sem redesenhar a pessoa.
- Cores litúrgicas apenas como informação semântica e sempre acompanhadas de texto.

## Sugestão inicial de tokens — calibrar contra a imagem
- `--bg: #F7EEDD`
- `--surface: #FFF9EF`
- `--surface-alt: #F3E7D4`
- `--olive-950: #343A1F`
- `--olive-800: #4B562B`
- `--gold: #B8893C`
- `--gold-dark: #956824`
- `--ink: #472D1B`
- `--muted: #705B48`
- `--border: #DFCBAA`
- `--focus: #936D2B`
Esses valores são um ponto de partida; comparar visualmente as referências, revisar contraste e criar variante dark coerente.

## Tela 1 — Início / Preparar Missa
1. Hero horizontal com a ilustração de Santa Cecília à esquerda (tamanho controlado), pergunta central "Qual missa você vai preparar?", texto curto e cartão de escolha (data, celebração, tempo, cor, ação). **Ocupação vertical contida**: a pessoa deve visualizar sugestões já na primeira tela em desktop.
2. Área principal à esquerda: título "Sugestões por momento da Missa", abas Entrada, Preparação das Oferendas, Comunhão e outros momentos já suportados no domínio, cards de músicas compactos com justificativa e CTA "Adicionar".
3. Painel lateral direito: "Repertório em construção", lista de itens com momento, tom, ordem e ações existentes; sticky dentro de limites do viewport, sem bloquear conteúdo.
4. Abaixo das sugestões, exploração por celebração e por tempo litúrgico em atalhos compactos; **não repetir o mesmo filtro em vários lugares sem motivo**.
5. Espaço para mídia futura só quando relevante; não exibir player ou thumbnail fake quando não existir URL.
6. Quando a data não existir/revisão pendente/sem músicas classificadas, renderizar estados vazios honestos e úteis, sem inventar leituras, músicas ou recomendações.

## Tela 2 — Catálogo / Leitor
1. Três zonas no desktop: lista pesquisável à esquerda, música selecionada e cifra no centro, repertório atual à direita.
2. Lista de músicas compacta e rolável dentro da zona dedicada; filtros acima; item ativo evidente; seleção rápida sem obrigar navegação de ida e volta.
3. Painel central mostra título, autor, tags litúrgicas reais, descrição quando existir, tom original e controles de transposição, botão "Adicionar ao repertório", letra/cifra com legibilidade acima de decoração.
4. Seção futura de mídia perto do detalhe selecionado (aba ou bloco compacto): miniatura + título e botão; quando tiver link real do YouTube, carregar o iframe somente ao ativar (lazy) e usar política de privacidade adequada. Não implementar integração real sem contrato de dados aprovado.
5. Painel direito sticky: repertório da conta ou em construção. Se sem autenticação, CTA para entrar, não dados pessoais de sessão anterior.
6. Ações adicionais (PDF, partitura, áudio, favoritar, play) só funcionais se implementadas; caso contrário **ocultar** ou rotular "Em breve" de forma não enganosa.

## Responsividade
- >= 1280px: 3 zonas no catálogo, 2 zonas no planejador. Evitar colunas esmagadas; ajustar a largura mínima do painel central.
- 768–1279px: catálogo com lista + detalhe; repertório vira drawer acessível; planejador empilha painel de repertório quando necessário.
- <= 767px: uma coluna, busca visível, filtros em scroll horizontal, música/cifra em tela própria ou painel, repertório em drawer/bottom-sheet com controle claro. Preserve navegação mobile simples.
- Evitar scroll horizontal na página; listas internas podem ter rolamento próprio com altura coerente; sticky deve respeitar cabeçalho e teclado virtual.

## Dados reais e permissões
- Os screenshots **não são fonte de dados**: títulos, autores, melodias, números, datas, textos, justificativas, vídeos e leituras visíveis nos mockups são apenas conteúdo visual de exemplo. Nunca criar essas informações no MongoDB nem copiá-las como dados reais.
- Consultas devem vir das APIs existentes. Não afrouxar Better Auth, os DTOs públicos, direitos de ChordPro, snapshot de compartilhamento, estado editorial litúrgico, revisão If-Match, isolamento por owner e regras do MongoDB.
- Não transformar o catálogo em dados locais. Não criar nova fonte editável nem cache offline.

## Critérios de aceitação visual/funcional
1. Antes de codificar, inventariar componentes/rotas reais da versão atual e mapear cada zona dos screenshots para componentes existentes ou novos.
2. Fazer capturas da versão anterior em 1448×1086, 1280×800, 390×844 e 360×800; preservar evidência da linha de base.
3. Implementar shell/tokens e componentes compartilhados. Depois reproduzir primeiro o Catálogo e depois o planejador/home. Não alterar lógica do calendário/recomendação.
4. Fazer capturas após cada subentrega e comparar lado a lado com `referencia-01` e `referencia-02`, ajustando alinhamento, tamanho do hero, gaps, cores, radii, font-weight, largura das colunas, hierarquia e densidade.
5. Validar com músicas reais/autorizadas ou fixtures locais, inclusive lista vazia, falta de cifra, data sem cobertura, data não revisada, sessão expirada, link público, erros de API.
6. Testar teclado, foco, navegação, contraste, zoom 200%, 360px e 1280px, e scroll horizontal; não dizer Safari/iOS testado sem executar.
7. Executar lint, TypeScript, testes unitários/integração e build; não tocar em banco de desenvolvimento por meio de testes destrutivos.
8. No relatório, anexar screenshots antes/depois, listar desvios visuais inevitáveis do mockup, explicar mudanças e possíveis regressões.

## Sequenciamento
Não rodar a etapa de redesign paralelamente a outra implementação do Claude no mesmo working tree. Esperar concluir e revisar a 2E.4 antes de integrar a 2E.4A. Não fazer commits automáticos, mas **recomendar um checkpoint Git antes da mudança visual** (sem incluir `.env` e segredos).
