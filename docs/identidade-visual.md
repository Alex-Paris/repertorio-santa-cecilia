# Identidade visual

Identidade da Etapa 2E.4A, a partir das referências aprovadas (`referencia-01-inicio-preparar-missa.png`, `referencia-02-catalogo-leitor.png`) e do logotipo do Grupo de Canto Santa Cecília, refinada em **24/11/2026**. A pasta `repertorio-redesign-referencias/`, com essas imagens, o logotipo original e o briefing, saiu do projeto depois da Etapa 2F.1 e continua no histórico do Git (commit `07e76bc`). Esta revisão visual preserva contratos HTTP, MongoDB, direitos, revisões (`If-Match`) e regras litúrgicas.

## Nome

O site se chama **Repertório Santa Cecília** (`repertoriosantacecilia.com.br`). O nome completo fica no título das abas (`Catálogo · Repertório Santa Cecília`), nos metadados e nos textos editoriais ("Sugestão do Repertório Santa Cecília"). No cabeçalho, ele aparece em duas linhas: "Repertório" em serifa e "Santa Cecília" em itálico dourado (`--header-accent`). Assim o nome inteiro cabe em todas as larguras, a partir de 360px, e a marca ficou mais estreita que a anterior (190px contra cerca de 213px no computador). O antigo lema "Música e liturgia católica" saiu do cabeçalho. Nome e endereço ficam em `src/lib/site.ts`.

## Santa Cecília

- Logotipo do Repertório Santa Cecília (Santa Cecília com auréola, manto verde e lira dourada, fundo transparente): o arquivo original fica fora do código. `src/assets/brand/santa-cecilia-marca.webp` é um recorte quadrado dele (auréola, rosto e lira), 192×192, sem redesenho, exibido no cabeçalho num círculo marfim fixo para manter as cores do desenho nos dois temas.
- `src/app/icon.png` (192×192, cantos arredondados) e `src/app/apple-icon.png` (180×180, opaco) usam o mesmo recorte sobre marfim. Substituem o antigo `icon.svg` de notas musicais.
- `src/assets/brand/santa-cecilia-logo.webp`: o logotipo inteiro, só aparado nas bordas transparentes, 620×797, no topo das páginas principais. Assim o cabeçalho e o topo mostram o mesmo desenho. A ilustração em aquarela do Grupo de Canto Santa Cecília, usada até aqui no topo, saiu do código e continua no histórico do Git (`santa-cecilia-ilustracao.webp`, até o commit `2145dd0`).
- Todos os recortes saem do arquivo enviado, sem redesenho nem geração de imagem, mantendo as proporções. O rodapé ainda traz o crédito da ilustração em aquarela: "Ilustração de Santa Cecília: Grupo de Canto Santa Cecília, Paróquia Menino Jesus de Praga e São Francisco Xavier."
- A janela ogival do topo é um traço decorativo simples (`GothicWindow`), sem figura humana; some abaixo de 1280px.

## Tokens

Definidos em `src/app/globals.css`, com variante escura.

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--background` | `#f7f5ee` | `#141a15` | Pergaminho claro / verde profundo |
| `--card` | `#fffdf8` | `#1e281f` | Superfícies distintas do fundo |
| `--foreground` | `#30352b` | `#e5eadc` | Texto principal |
| `--heading` | `#35402b` | `#edf0e2` | Títulos em serifa |
| `--primary` | `#465b32` | `#b8d29c` | Ações e seleção em oliva |
| `--header` | `#2f3e25` | `#101710` | Cabeçalho e faixa do painel |
| `--header-accent` | `#d9b46c` | `#dbb873` | Dourado da marca e seleção no cabeçalho |
| `--gold` / `--gold-strong` | `#a77d34` / `#88631c` | `#dbb873` / `#dbb873` | Apoio e ornamentos; forte para texto |
| `--border` | `#dce0d2` | `#394638` | Divisores e cartões |
| `--input` | `#8b927f` | `#75826c` | Contorno dos controles |
| `--field` | `#fffefa` | `#151e16` | Fundo opaco de campos |
| `--muted-foreground` | `#646b5b` | `#afbaa5` | Texto secundário |
| `--chord` | `#3e5f24` | `#c7ddad` | Acordes |

O oliva acompanha o manto da marca; o dourado fica como apoio. O tema escuro usa superfícies verdes e texto claro, com ações em oliva claro. Texto secundário sobre cartão: **5,44:1** no claro e **7,54:1** no escuro; botão principal: **7,37:1** e **9,91:1**. O novo contorno sobre o fundo opaco do campo mede **3,19:1** no claro e **4,20:1** no escuro. Na paleta anterior, os pares de borda/fundo da página mediam aproximadamente 1,53:1 e 1,93:1, e os controles também usavam transparência. Os valores são dos pares de tokens sólidos, não uma certificação de todos os estados. As cores litúrgicas continuam separadas da paleta de ações e sempre acompanhadas do nome.

## Análise e aplicação de 24/11/2026

| Área | Problema observado | Alteração aplicada |
| --- | --- | --- |
| Temas | Campos transparentes se confundiam com o pergaminho e bordas pouco distintas nos dois temas | Fundos próprios para campos, contornos mais definidos, superfícies e texto secundário separados |
| Administração | Ferramentas dispersas, pouca orientação entre áreas e conteúdo estreito no desktop | Navegação própria para catálogo, liturgia, contribuições, importação e qualidade; opção ativa única; coluna lateral no desktop e faixa rolável no celular |
| Formulários | Seções longas sem separação e salvar distante dos campos | Cartões por assunto, atalhos para seções da celebração e barra de ações visível; em telas baixas a barra volta ao fluxo normal |
| Controles | Tamanhos e estados inconsistentes | Base de botões de 40–44px, campos e seletores de 44px, estado de foco, erro, hover e desabilitado consistentes, mantendo variantes compactas |
| Estados editoriais | Publicada e em revisão tinham pouco destaque | Etiquetas de situação com texto e cores semânticas, além de contagem real de músicas na lista |
| Login e cadastro | Formulários soltos, sem um contorno claro | Painéis centralizados com introdução, preservando Facebook, e-mail, validação e mensagens |
| Navegação geral | Ícones empilhados e estado selecionado pouco evidente; tema no desktop dentro do menu | Navegação horizontal mais compacta, item ativo destacado, seletor de tema direto em telas largas e indicador na barra móvel |
| Catálogo | Links de filtro usavam `aria-pressed`, atributo inadequado para links | `aria-current` identifica o filtro ativo; nomes e URLs continuam preservados |
| Leitura e movimento | Foco podia se aproximar das barras fixas | Espaço de rolagem para foco e campos; respeito a movimento reduzido; paletas próprias da apresentação e papel branco mantidos |

Referências utilizadas: [formulários do Primer/GitHub](https://primer.style/product/ui-patterns/forms/) para agrupamento, navegação e clareza das ações; [escala do Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale) para separar fundo, superfície, controle, hover, borda e texto; [contraste WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) para verificar legibilidade. Foram adotados padrões de uso, mantendo ilustração, fontes e identidade do Santa Cecília.

### Verificação desta revisão

- **Antes:** 20 combinações de página, tema e largura. O catálogo apresentou uso inválido de `aria-pressed` nos links nos quatro cenários; corrigido para `aria-current`.
- **Depois:** 19 páginas, em 1440px e 390px, nos temas claro e escuro: **76 cenários**, sem rolagem horizontal, erros de JavaScript ou violações detectadas pelo axe nos estados examinados. Inclui início, catálogo e música, preparação da missa, repertórios, biblioteca e leitura, login, cadastro, conta, administração de catálogo/liturgia/contribuições, importação, qualidade e privacidade.
- **Uso real no navegador:** navegação e seção administrativa ativa em 320, 390, 768 e 1024px, além de 1440px; tema mantido após recarregar; validação da celebração com mensagem visível e foco; preenchimento preparado, navegação por âncoras e salvamento local; papel branco na impressão; apresentação clara independente do tema escuro; diálogo de exclusão aberto e cancelado.
- **Código:** lint, TypeScript, build de produção, 1.433 testes unitários e 54 testes de integração de autenticação/calendário/consulta passaram.
- **Ambiente:** contas, músicas, celebrações e repertórios fictícios em MongoDB local descartável. Nenhuma conta ou dado de produção foi criado, editado ou removido. Não houve commit nem deploy automático. As verificações são amostras com dados de teste, sem afirmar certificação completa de acessibilidade.

Tipografia: Fraunces (serifa, tamanho óptico 72, sem as formas "suaves") para títulos, subtítulos em itálico e a letra da cifra no leitor do catálogo; Geist para a interface. Breakpoint extra `hd` (1400px) para as colunas largas das referências.

## Componentes

| Componente | Arquivo | Zona da referência |
| --- | --- | --- |
| Cabeçalho, marca, busca, menu "Conta" | `components/layout/app-shell.tsx`, `brand.tsx`, `header-search.tsx`, `account-menu.tsx`, `navigation.tsx` | Faixa oliva das duas telas |
| Topo com ilustração | `components/layout/page-hero.tsx`, `components/brand/*` | Título, subtítulo e cruz |
| Escolha da missa | `features/liturgy/components/celebration-chooser.tsx` (`CelebrationChooser`) | Cartão "Data da missa · Celebração · Tempo · Cor" |
| Sugestões em abas | `features/liturgy/components/mass-planner.tsx` | Abas de momentos e cartões |
| Atalhos de exploração | `celebration-chooser.tsx` (`MassExplore`) | "Explorar por celebração / por tempo litúrgico", só no início (`stacked`) |
| Início | `features/liturgy/components/home-start.tsx` (`HomeMassStart`, `HomeStart`) | Próxima celebração, outra data, atalhos e "Seus repertórios" |
| Preparação da missa (servidor) | `features/liturgy/components/mass-preparation.tsx` | `/preparar-missa` |
| Repertório em construção / atual | `features/repertoires/components/repertoire-builder.tsx`, `features/catalog/components/catalog-repertoire-dock.tsx` | Painel oliva da direita |
| Busca, filtros rápidos e lista | `features/catalog/components/catalog-results.tsx` | Zona esquerda do catálogo |
| Música aberta | `features/catalog/components/catalog-song-detail.tsx` | Zona central do catálogo |
| Referência em vídeo | `features/songs/components/video-reference.tsx`, `features/songs/domain/video-reference.ts` | "Referências em vídeo" |
| Etiquetas litúrgicas | `features/liturgy/components/liturgy-tags.tsx` | Etiquetas de momento e tempo |

## Comportamento por largura

- **A partir de 1280px:** catálogo em três zonas (lista, música, repertório) e planejador em duas (sugestões, repertório). As zonas ficam presas sob o cabeçalho e só rolam por dentro quando o conteúdo passa da tela.
- **768 a 1279px:** catálogo com lista e música; o repertório vira um painel flutuante recolhível no canto inferior.
- **Até 767px:** uma coluna; a música abre em "tela própria" (`?musica=` esconde a lista, com "Voltar à lista"); filtros rápidos em rolagem horizontal; o repertório vira barra inferior recolhível, acima da navegação do celular.

## Dados e honestidade

- Nada dos mockups virou dado: títulos, autores, leituras, contagens e vídeos vêm do MongoDB pelas rotas e serviços de antes.
- O Início só escolhe a missa: destaca a próxima celebração cadastrada (a mesma busca de "Próximas celebrações") com o botão "Preparar esta missa", oferece "Outra data" e os atalhos por celebração e por tempo litúrgico, com "Seus repertórios" ao lado. Sugestões por momento, as músicas sugeridas e o repertório em construção ficam só em `/preparar-missa`, que, aberta sem data, já vem com a próxima celebração escolhida (a data continua editável no topo). Sem base, o Início mostra a escolha da data e um aviso; sem banco, avisa que o calendário está indisponível.
- O estado editorial da celebração fica sempre à vista; leituras, temas e fontes estão em "Leituras, temas e fontes".
- Partitura, PDF, áudio, favoritos e o botão de tocar não existem no produto e não aparecem.
- Vídeo: sem vídeo aprovado, só o aviso "Sem vídeo de referência" no detalhe; com vídeo aprovado, o player de privacidade aprimorada (`youtube-nocookie.com`) só carrega depois do pedido. Nos cartões do Catálogo e da Missa, o botão circular ▶ solicita reprodução com um clique, a partir do segundo cadastrado na administração. O player mantém os controles visíveis; se o navegador bloquear o som, a pessoa pode iniciá-lo no vídeo. Só uma música toca por aba, e fechar, Esc, sair da tela ou ocultar a aba interrompem a mídia. "Abrir no YouTube" leva ao mesmo ponto inicial em outra aba.

## Desvios assumidos em relação às referências

- **Onze momentos, não quatro.** As abas seguem o domínio (Entrada a Encerramento) e rolam na horizontal; não há "Ofertório" nem "Final" com outros nomes.
- **Sem tocar nem favoritar** nos cartões e na lista: não há esses recursos.
- **Uma aba só ("Letra e cifra")** no leitor: sem partitura nem PDF.
- **Tom com botões −/+**, não com menu, para manter as faixas de transposição e os rótulos acessíveis existentes; ordem com setas (sem arrastar).
- **Aviso editorial** entre o topo e as sugestões, que a referência não tem, porque a celebração ainda não foi revisada.
- **"Catálogo de músicas"** em caixa de frase, como no restante do português da interface.
- **Busca do cabeçalho:** "Buscar músicas ou autores…", porque ela consulta o catálogo; celebrações têm a sua própria busca no menu "Conta".
- **"Minhas músicas"** saiu da barra superior e foi para o menu "Conta" (e para "Conta" no celular).
- **Ícone do cabeçalho:** o detalhe de Santa Cecília no lugar da lira genérica do mockup, como pede o briefing.

## Telas mais práticas (remodelagem)

Análise das telas com conta e dados de teste, a 1448px e 390px. O que pesava: o topo com ilustração repetido em todas as telas de trabalho, textos de apoio duplicados, atalhos repetidos do início na página da missa e controles empilhados. Princípios aplicados: um assunto e uma ação principal por tela, detalhes a pedido (revelação progressiva) e, na leitura, uma barra única com cifra ou letra, tom e tamanho, como nos leitores de cifra para palco.

- **Topo:** o logotipo grande fica só no início (`PageHero` padrão). Missa e catálogo usam `align="compact"`: título e uma linha de apoio, sem ilustração, com o mesmo espaço sob o cabeçalho (`--page-top`). No celular, a página da missa caiu de cerca de 1990px para 1235px de altura.
- **Missa:** sem os atalhos de exploração (ficam no início) e sem o aviso de vídeos "em breve"; um link "Ver outras celebrações" sob a escolha da data. O aviso de que as sugestões não são aprovação oficial da Igreja continua, em uma linha; a frase repetida "Sugestões para (celebração)" saiu, porque a celebração já está no topo. Os cartões mostram título, autoria, tom quando conhecido e ações; motivos, etiquetas de momento, observações de indicação e mensagens de procedência não se repetem em cada música. A seleção continua usando a mesma classificação.
- **Catálogo:** sem o cartão "Dica" e sem indicadores de disponibilidade de cifra na lista da esquerda; as etiquetas da música aberta não ficam mais sob os botões (quebram de linha antes de encolher). As observações de indicação ficam nos detalhes recolhidos de classificação e fontes, sem ocupar o painel de leitura. O cadastro e a edição de referências do YouTube ficam nos formulários administrativos, na etapa B; a consulta pública apenas exibe o vídeo.
- **Música da biblioteca:** cifra ou letra, tom e tamanho numa barra só, presa sob o cabeçalho, igual à do catálogo. Os botões de restaurar tom e tamanho só aparecem quando há o que restaurar.
- **Repertório:** a lista de músicas vem primeiro, com o título "Músicas" e a quantidade; a busca para adicionar abre em "Adicionar músicas" (aberta de início no repertório vazio). Celebração e data numa linha.
- **Lista de repertórios:** cada cartão mostra a data e a celebração da missa junto da quantidade de músicas. As próximas missas (de hoje em diante) vêm primeiro, da mais próxima para a mais distante; os demais seguem do editado mais recentemente (`groupRepertoiresForList`). Os títulos "Próximas missas" e "Outros repertórios" só aparecem quando há os dois grupos.
- **Menu "Mais" (`MoreActionsMenu`):** na música da biblioteca ficam à vista só "Apresentar" e "Imprimir"; "Editar", "Sugerir para o catálogo" (ou o estado da sugestão) e "Excluir" ficam em "Mais". É um painel simples (não um menu com setas): os itens são links e botões na ordem do Tab, fecha com Esc, com clique fora e ao seguir um link, e continua montado quando fechado, para o diálogo de exclusão funcionar a partir dele e devolver o foco.

## Hero, espaçamento e apresentação (Etapa 2F.2)

- **Hero em dois containers:** o externo (`section[data-hero][data-bleed]`) vai de ponta a ponta da página; o interno limita conteúdo, ilustração e janela a 1448 px. A luz quente se estende 24rem além do conteúdo e se dissolve, sem as faixas laterais que apareciam em janelas largas (o fundo era cortado na borda do conteúdo). Sem `100vw`: só `overflow-x: clip` na seção.
- **Páginas largas:** o `main` ocupa a tela toda e cada bloco fica em 1448 px (`[data-layout="wide"] > :not([data-bleed])`).
- **Espaço sob o cabeçalho:** regra única `--page-top` (20/32/40 px); o Hero dá o próprio espaço. Vale também para páginas largas sem Hero, como a da música do catálogo.
- **Refinamentos (Etapa 2F.2B):** brilho mais forte atrás da Santa Cecília, com máscara na base do Hero; páginas comuns numa coluna de 56rem com margens de 16/24/32px; `PageHeader` com as ações descendo para a linha de baixo quando não cabem; "Minha conta" em cartões por assunto; mais respiro na área da cifra da apresentação. Detalhes em [leitura-e-impressao.md](leitura-e-impressao.md#páginas-comuns-etapa-2f2b).
- **Apresentação:** superfície clara própria (`.presentation-light`: pergaminho `#fdf9f1`, letra `#22180f`, acordes `#2e5208`), independente do tema do site; a escura (`.presentation-dark`) é escolha de quem apresenta.
- **Papel:** a impressão usa sempre branco e quase preto, em serifa, fora do tema do site. Detalhes em [leitura-e-impressao.md](leitura-e-impressao.md).

## Refinamento de usabilidade (Etapa 2E.4B)

Mesma identidade; mudanças de densidade, navegação e prioridade de leitura. Nenhuma regra de negócio, dado ou contrato mudou.

- **Aviso editorial único** (`CelebrationNotice`): a situação da celebração ("Dados em revisão", "Celebração revisada", "Dados com divergência", "Dados em atualização") e a marca "Sugestões provisórias" ficam sempre à vista numa linha; o texto completo, os motivos das sugestões provisórias, as leituras, os temas e as fontes ficam no mesmo bloco, ao abrir "Detalhes, leituras e fontes".
- **Sugestões conforme a quantidade:** uma música vira um cartão largo (título, motivos e ações lado a lado); várias, cartões compactos em grade; nenhuma, um estado vazio com o motivo, a busca no catálogo daquele momento e atalhos para os momentos que têm sugestões.
- **Onze momentos sem opções escondidas:** no computador as abas quebram linha (todas visíveis; duas linhas a 1448px), com a quantidade de sugestões; momentos sem sugestão ou sem canto ficam tracejados e esmaecidos, mas escolhíveis. No celular, a fileira rola com setas de toque e bordas esmaecidas, e a aba escolhida volta à vista. Teclado: uma parada de Tab, setas, Home e End.
- **Catálogo mais denso:** topo compacto; lista em linhas (título e autoria numa linha, classificação e situação da cifra na outra); "Filtros litúrgicos" e os atalhos na mesma faixa. A lista mostra cerca de dez músicas acima da dobra a 1448×1086 (eram quatro).
- **Uma busca por vez:** na página do catálogo, o campo do cabeçalho dá lugar à busca da página (com filtros); nas demais páginas, inclusive na página própria de uma música, a busca do cabeçalho continua.
- **Cifra em primeiro lugar:** tom, transposição e tamanho da fonte numa barra presa ao topo enquanto a cifra rola; "Apresentar" e "Adicionar ao repertório" na linha das etiquetas (o painel de adicionar abre flutuando); a cifra não tem mais rolagem aninhada; classificação e fontes num bloco recolhível que diz, mesmo fechado, se a classificação foi conferida.
- **Vídeo:** sem link, só "Sem vídeo de referência"; com vídeo aprovado (a partir da Etapa 2F.1), "Referência em vídeo" abre um painel flutuante não modal, com Esc e foco de volta ao botão, sem tirar a cifra da área principal.
- **Repertório:** estado do salvamento ("Salvo na sua conta" / "Salvando…") e "Trocar de repertório" numa linha só; estado inicial com uma frase, o nome e "Criar repertório"; barra recolhida numa linha, com convite a entrar para visitantes.
- **Telas baixas** (altura até 520px: zoom de 200%, celular deitado): o cabeçalho rola com a página e a navegação inferior fica mais baixa.
