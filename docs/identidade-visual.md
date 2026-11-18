# Identidade visual

Redesign da Etapa 2E.4A, a partir das referências aprovadas (`referencia-01-inicio-preparar-missa.png`, `referencia-02-catalogo-leitor.png`) e do logotipo do Grupo de Canto Santa Cecília. A pasta `repertorio-redesign-referencias/`, com essas imagens, o logotipo original e o briefing, saiu do projeto depois da Etapa 2F.1 e continua no histórico do Git (commit `07e76bc`). Só a apresentação mudou: contratos HTTP, MongoDB, direitos, revisões (`If-Match`) e regras litúrgicas continuam os mesmos.

## Santa Cecília

- `src/assets/brand/santa-cecilia-ilustracao.webp`: recorte da ilustração do logotipo original (sem os textos), 620×640, com a transparência original. Usada no topo das páginas principais.
- `src/assets/brand/santa-cecilia-marca.webp`: detalhe do rosto e da lira do mesmo original, 192×192, exibido em círculo no cabeçalho.
- Os dois foram recortados e reduzidos do arquivo enviado, sem redesenho nem geração de imagem, mantendo as proporções. O crédito aparece no rodapé de todas as páginas: "Ilustração de Santa Cecília: Grupo de Canto Santa Cecília, Paróquia Menino Jesus de Praga e São Francisco Xavier."
- A janela ogival do topo é um traço decorativo simples (`GothicWindow`), sem figura humana; some abaixo de 1280px.

## Tokens

Definidos em `src/app/globals.css`, com variante escura.

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--background` | `#f4e8d2` | `#1b1a12` | Pergaminho, com luz suave no alto |
| `--card` | `#fff9ef` | `#25241a` | Superfícies marfim |
| `--foreground` | `#472d1b` | `#efe3cd` | Texto |
| `--heading` | `#4a2c19` | `#f3e2c0` | Títulos em serifa |
| `--primary` | `#4b562b` | `#c5b672` | Oliva: ações principais, abas ativas |
| `--header` | `#3a4123` | `#13140c` | Cabeçalho e faixa do painel |
| `--gold` / `--gold-strong` | `#b8893c` / `#87601f` | `#d2a452` / `#e3bd6b` | Ícones, divisores; o forte é legível como texto |
| `--border` | `#e3d1b2` | `#3d3a2b` | Bordas bege suaves |
| `--chord` | `#4e6524` | `#cdd68e` | Acordes |

Contraste (claro): texto secundário `#6b5543` sobre o fundo ≈ 5,8:1; dourado forte sobre marfim ≈ 5,4:1; oliva com texto marfim ≈ 7:1. As cores litúrgicas só tingem etiquetas e atalhos (`liturgicalTint`) e sempre vêm com o nome; o branco vira dourado claro para continuar visível.

Tipografia: Fraunces (serifa, tamanho óptico 72, sem as formas "suaves") para títulos, subtítulos em itálico e a letra da cifra no leitor do catálogo; Geist para a interface. Breakpoint extra `hd` (1400px) para as colunas largas das referências.

## Componentes

| Componente | Arquivo | Zona da referência |
| --- | --- | --- |
| Cabeçalho, marca, busca, menu "Conta" | `components/layout/app-shell.tsx`, `brand.tsx`, `header-search.tsx`, `account-menu.tsx`, `navigation.tsx` | Faixa oliva das duas telas |
| Topo com ilustração | `components/layout/page-hero.tsx`, `components/brand/*` | Título, subtítulo e cruz |
| Escolha da missa | `features/liturgy/components/celebration-chooser.tsx` (`CelebrationChooser`) | Cartão "Data da missa · Celebração · Tempo · Cor" |
| Sugestões em abas | `features/liturgy/components/mass-planner.tsx` | Abas de momentos e cartões |
| Atalhos de exploração | `celebration-chooser.tsx` (`MassExplore`) | "Explorar por celebração / por tempo litúrgico" |
| Preparação da missa (servidor) | `features/liturgy/components/mass-preparation.tsx` | Início e `/preparar-missa` |
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
- O Início abre a próxima celebração cadastrada (a mesma busca de "Próximas celebrações"). Sem base, mostra a escolha da data e um aviso; sem banco, "Calendário indisponível".
- O estado editorial da celebração fica sempre à vista; leituras, temas e fontes estão em "Leituras, temas e fontes".
- Partitura, PDF, áudio, favoritos e o botão de tocar não existem no produto e não aparecem.
- Vídeo: sem vídeo aprovado, só o aviso "Sem vídeo de referência"; com vídeo aprovado numa contribuição (Etapa 2F.1: provedor e identificador do YouTube), o player sem cookies (`youtube-nocookie.com`) só carrega depois do clique e nunca toca sozinho; "Abrir no YouTube" leva ao vídeo em outra aba.

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

## Hero, espaçamento e apresentação (Etapa 2F.2)

- **Hero em dois containers:** o externo (`section[data-hero][data-bleed]`) vai de ponta a ponta da página; o interno limita conteúdo, ilustração e janela a 1448 px. A luz quente se estende 24rem além do conteúdo e se dissolve, sem as faixas laterais que apareciam em janelas largas (o fundo era cortado na borda do conteúdo). Sem `100vw`: só `overflow-x: clip` na seção.
- **Páginas largas:** o `main` ocupa a tela toda e cada bloco fica em 1448 px (`[data-layout="wide"] > :not([data-bleed])`).
- **Espaço sob o cabeçalho:** regra única `--page-top` (20/32/40 px); o Hero dá o próprio espaço. Vale também para páginas largas sem Hero, como a da música do catálogo.
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
