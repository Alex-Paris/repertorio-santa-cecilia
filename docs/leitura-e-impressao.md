# Leitura sem cifras e impressão (Etapa 2F.2)

Modo **Letra** no leitor e na apresentação, e impressão de músicas e repertórios pelo próprio navegador (impressora ou "Salvar como PDF"). Nada é gravado de novo: a letra é sempre calculada a partir da cifra ChordPro armazenada, e o papel recebe só o que a pessoa já pode ler na tela.

## Modos Cifra e Letra

- Seletor **[Cifra] [Letra]** (`ReadingModeToggle`, em `features/songs/components/reader-controls.tsx`) na música particular, na música do catálogo, na música de um link público e nos ajustes do modo apresentação.
- A escolha fica nas preferências de leitura deste navegador (`repertorio.reader.preferences.v1`, campo `readingMode`), como o tamanho da fonte. Preferências antigas, sem o campo, valem "Cifra".
- **Cifra:** leitura de sempre, com transposição, tom do item no repertório e apresentação.
- **Letra:** sem acordes; a transposição some (não tem utilidade). O tom continua guardado no estado da tela ou no item do repertório e volta igual ao retornar para Cifra. A fonte e a rolagem continuam disponíveis.
- Não existe campo com uma cópia da letra: `ChordSheet` recebe `mode="lyrics"` e deriva a letra na hora.

### Interpretação do ChordPro

`extractLyrics` (`features/songs/services/chordpro-lyrics.ts`) trabalha sobre o resultado do parser já existente (`parseChordPro`), nunca sobre o texto com uma regex genérica:

- junta os trechos entre acordes da mesma linha (`Se[A]nhor` → "Senhor"), com acentos e pontuação;
- espaços deixados só para afastar acordes viram um espaço;
- preserva estrofes, refrão (`{start_of_chorus}`, com o rótulo "Refrão"), versos e indicações textuais (`{comment: Refrão 2x}`);
- remove acordes, diretivas (`{title}`, `{key}`…), metadados e comentários de arquivo (`#`);
- remove linhas e seções só de acordes (introdução, solo); uma indicação sozinha, como "Refrão 2x", fica;
- a letra é a mesma em qualquer tom (a transposição só mexe nos acordes).

Leitor, apresentação e impressão usam o mesmo `ChordSheet`: uma só interpretação musical.

## Impressão: quatro formatos

A impressão é sempre a nativa (`window.print()`): impressora física ou "Salvar como PDF". Não há geração de PDF no servidor.

| Formato | Onde | O que sai no papel |
| --- | --- | --- |
| A. Música com cifra | `/musicas/[id]/imprimir?modo=cifra&tom=N`, `/catalogo/[id]/imprimir?modo=cifra&tom=N` | Título, autoria, "Tom: X" (o tom da leitura) e a cifra com os acordes alinhados sobre a sílaba |
| B. Música só com a letra | `…/imprimir?modo=letra` | Título, autoria e a letra, sem acordes nem comandos |
| C. Repertório, só letras | `/repertorios/[id]/imprimir?formato=letras` | Resumo inicial (nome, celebração, data e a lista "Momento: Título"), depois "Momento: Título" e a letra de cada música, uma depois da outra |
| D. Repertório, com cifras | `/repertorios/[id]/imprimir?formato=cifras` | Momento, título, autoria e o tom de cada item; cada música começa numa nova folha |

O mesmo vale para um link público: `/s/[token]/imprimir?formato=letras|cifras`.

Acesso nas telas (menu discreto "Imprimir", com os formatos):

- **música** (particular, do catálogo ou num repertório): "Com cifra" e "Somente letra", no tom em que está sendo lida;
- **repertório**: "Imprimir letras" e "Imprimir cifras";
- **preparação da missa** (e o painel do repertório no catálogo): link "Imprimir" ao lado de "Salvo na sua conta", que abre a pré-visualização do repertório atual. O repertório em construção já é salvo a cada mudança: não há passo de salvamento extra;
- **link público**: "Imprimir letras" e "Imprimir cifras".

### Pré-visualização

Antes de imprimir: nome, quantidade de músicas, ordem, momentos, avisos de músicas sem conteúdo, o formato (Somente letras / Com cifras, ou Com cifra / Somente letra), **Imprimir** e **Voltar**, seguidos da própria folha num "papel" branco. Trocar o formato não recarrega a página e atualiza a URL.

## Paginação

CSS em `src/app/globals.css` (seção "Impressão"):

- `@page { size: A4 portrait; margin: 16mm 15mm }`; papel branco, texto `#161616`, acordes em `#0b3a00` negrito; corpo 11,5 pt (letras) ou 12 pt (cifras), na serifa da identidade.
- **Resumo do repertório (Etapa 2F.2B), só no formato de letras:** sob o nome, a celebração e a data, a lista "Ordem das músicas", numerada, com "Momento: Título" de cada item (inclusive os sem conteúdo). Fica inteiro na primeira folha (`break-inside: avoid`), e as letras começam logo abaixo, sem página nova. O repertório com cifras e as músicas individuais não têm resumo.
- **Repertório só com letras:** as músicas seguem uma depois da outra, sem nova página. O título (`.print-song-head`, `break-after: avoid`) fica preso ao início da letra, e cada estrofe fica inteira (`break-inside: avoid`): um título nunca fica sozinho no fim da página.
- **Repertório com cifras:** cada música a partir da segunda tem `break-before: page`. Uma música longa continua normalmente nas folhas seguintes (uma folha nova **não** limita a música a uma página); não há quebra depois da última, então não sobram folhas em branco.
- Fora do papel: cabeçalho, navegação do celular, rodapé, avisos (toasts), botões e controles (`data-print-hide`), e o indicador de desenvolvimento do Next.
- O tema escuro do site não chega ao papel: `color-scheme: light`, fundo branco forçado e cores próprias da folha.

## Momentos por item

A impressão **reutiliza** o momento já gravado em cada item do repertório (`RepertoireItem.moment`, definido ao incluir a música na preparação da missa). Nenhum campo, modelo, rota ou retrato mudou para isso.

- Ordem: a ordem atual do repertório (`position`).
- Cabeçalho: "Entrada: Nome da música".
- Sem momento: identificação neutra pela posição, "Música 3: Nome", sem inventar classificação.
- No link público, o momento é o que foi publicado no retrato.

## Direitos e disponibilidade

A impressão não tem rota de dados própria; a folha é montada no navegador com as mesmas fontes autorizadas do leitor:

- **biblioteca da conta** (sessão validada, só as músicas e repertórios da própria conta);
- **catálogo**: a projeção pública (`toCatalogSongView`), que só traz a cifra com permissão de exibição; rascunhos e despublicadas não existem;
- **link público**: o retrato publicado, com a mesma validação e revogação da página do link; só entra a cifra que o proprietário autorizou ao publicar.

Imprimir é tratado como reprodução: nada além do que já está na tela vai para o papel. Músicas sem conteúdo continuam na ordem, com um aviso objetivo no lugar da letra (nunca omitidas nem preenchidas):

| Situação | Aviso |
| --- | --- |
| A música saiu da biblioteca ou do catálogo | "Música indisponível: ela saiu da biblioteca ou do catálogo." |
| Link externo | "A cifra está numa fonte externa e não é reproduzida aqui." |
| Sem cifra, só metadados ou sem permissão de exibição | "Letra e cifra não disponíveis para impressão." |
| Só acordes, no formato de letras | "Esta cifra não tem letra cadastrada, só acordes." |
| Link público sem a cifra autorizada | "A letra e a cifra desta música não foram incluídas neste compartilhamento." |

Anotações particulares dos itens nunca são impressas. Propostas de contribuição não aprovadas não aparecem (não estão no catálogo). Nenhum conteúdo é buscado em sites externos.

## Modo apresentação

- Superfície própria, independente do tema do site: **clara por padrão** (pergaminho muito claro `#fdf9f1`, letra `#22180f`, acordes `#2e5208`), com pouca decoração. "Fundo: Claro | Escuro" nos ajustes (preferência `presentationTheme`).
- Com o modo Letra, apresenta só a letra; o tom e a transposição saem do cabeçalho e dos ajustes.
- Preservados: tela cheia, tamanho da fonte, rolagem automática, atalhos (Espaço, ← →, Esc), navegação entre as músicas do repertório e a transposição (na Cifra).
- Cabeçalho, ajustes e rodapé ficam fora da área da cifra (coluna flexível): abrir os ajustes encolhe a área rolável, sem cobrir versos.
- Respiro (Etapa 2F.2B): a área da cifra tem margem lateral de 1,25rem no celular e 2,5rem a partir de 768px (sempre respeitando a área segura do aparelho), 1,5–2,5rem no alto e uma folga no fim (`max(4rem, 20dvh)`), para os últimos versos subirem acima do rodapé. As barras e os ajustes usam 0,75rem / 1,5rem. Menos que uma página comum, para sobrar largura à letra.

## Hero e espaçamento das páginas

- **Brilho do Hero (Etapa 2F.2B):** um núcleo dourado mais forte atrás da Santa Cecília (30%) e um halo largo (20%), com a mesma paleta; uma máscara dissolve a luz até a base da seção, sem linha de corte nos temas claro e escuro.
- **Hero** (`components/layout/page-hero.tsx`): container externo `section[data-hero][data-bleed]` de ponta a ponta da página, e container interno com o conteúdo, a ilustração e a janela na largura do site (1448 px). A luz quente passa 24rem além do conteúdo dos dois lados e se dissolve aos poucos; a seção corta só na horizontal (`overflow-x: clip`), na borda da tela, sem `100vw` e sem esconder menus que abram para baixo.
- **Páginas largas** (`data-layout="wide"`): o `main` ocupa a tela toda e cada bloco fica limitado a 1448 px com a mesma margem lateral de antes; só faixas `data-bleed` vão de ponta a ponta.
- **Espaço sob o cabeçalho:** uma regra única, `--page-top` (20 px no celular, 32 px a partir de 768 px, 40 px a partir de 1024 px), no `main`. Com um Hero no topo, o próprio Hero dá esse espaço. A página da música do catálogo, que não tem Hero e começava a 16–24 px do cabeçalho, passou a seguir a regra comum, como as demais.

## Páginas comuns (Etapa 2F.2B)

- **Contêiner único:** as páginas sem `data-layout="wide"` usam uma coluna de 56rem (era 48rem), com margem lateral de 16px no celular, 24px a partir de 640px e 32px a partir de 768px (`--page-column`, `--page-gutter` em `globals.css`), sem margens por rota. O link público usa a mesma coluna.
- **Navegação sem recarregar:** ao trocar de página, o Next (com Cache Components) mantém a página anterior escondida (`display: none`) dentro do mesmo `main`. Por isso o layout não pode depender do que o `main` contém: uma regra `main:has([data-layout=wide])` continuava valendo depois de sair do catálogo, e o repertório ficava sem margem até recarregar. Agora o `main` ocupa a largura toda e cada bloco visível recebe a própria margem (`:where(main#conteudo) > …`, especificidade zero: um formulário com largura própria menor continua com ela). O espaço sob o cabeçalho (`--page-top`) fica sempre no `main`, e o Hero no topo de uma página larga o compensa com margem negativa. Sem JavaScript; a regra `:has` no `main` deixou de existir.
- **Cabeçalho da página (`PageHeader`):** título e ações ficam lado a lado só quando cabem (o título tem largura mínima de 20rem); sem espaço, as ações descem para a linha de baixo. Antes, nas páginas com muitas ações (música particular, repertório), o título ficava espremido em três linhas e, na música, os botões chegavam a cobrir o começo do título.
- **Minha conta:** seções em cartões, em duas colunas a partir de 768px: **Conta** (nome, e-mail, sessão e "Sair da conta"), **Biblioteca e repertórios** (Minhas músicas, Repertórios, Compartilhamentos, Importar biblioteca antiga), **Contribuições** (Minhas sugestões) e, só para quem tem o papel, **Administração** (catálogo, contribuições, liturgia). Cada ação é uma linha com ícone, nome e o que se faz ali. Os destinos são os mesmos de antes.

## Testes

- Unitários: extração da letra (`chordpro-lyrics.test.ts`), modelo de impressão (`print-model.test.ts`), folha, pré-visualização e menu (`print-ui.test.tsx`), modo Letra no leitor e na apresentação (`reading-mode-flows.test.tsx`).
- Integração (`tests/integration/printing.test.ts`): biblioteca particular, catálogo com e sem permissão, repertório misto, ordem, alterações concorrentes, outra conta, link público autorizado e revogado.
- Navegador (Chrome headless, 360/390/768/1280/1448 px): leitor, apresentação, pré-visualizações, Hero e espaçamento; PDFs gerados pelo próprio Chrome (`Page.printToPDF`, com o CSS de impressão) e lidos página a página, em tema claro e escuro.

## Limitações

- As folhas de continuação não repetem o título da música.
- Não há escolha de papel, margens, tamanho de letra nem colunas na impressão.
- O modo Letra é uma preferência por navegador (não por música nem por conta).
- A quebra de página segue o motor de impressão do navegador; validado no Chrome. Safari, iOS e Firefox não foram testados.
