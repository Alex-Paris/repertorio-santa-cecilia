# Arquitetura litúrgica

Etapa 2E.2. Este documento descreve como o Repertório Web passou a organizar cantos pela celebração: a classificação das músicas, a base de celebrações, as sugestões e o repertório da missa.

> **Etapa 2E.3:** as celebrações saíram do código e passaram a ser dados editoriais no MongoDB (`liturgical_celebrations`), com estado de revisão, proveniência por fato, histórico e administração em `/admin/liturgia`. O modelo, o processo de revisão, a cobertura atual e a viabilidade de uma fonte automatizada estão em [curadoria-liturgica.md](curadoria-liturgica.md). As seções abaixo sobre a base editorial descrevem a Etapa 2E.2; onde algo mudou, há uma nota.

## Direção do produto

O Repertório Web é uma plataforma de cifras católicas e de planejamento musical da Santa Missa. A pergunta que organiza a experiência é **"Qual missa você vai preparar?"**.

- A página inicial e `/preparar-missa` são públicas. Login só é pedido para ações privadas, como salvar um repertório.
- A consulta parte da celebração: data, contexto litúrgico, momentos da missa e sugestões para cada um.
- O catálogo, os repertórios, o leitor, a transposição, o modo apresentação, os links públicos e a administração das etapas anteriores continuam os mesmos.
- A classificação e as sugestões são **editoriais do Repertório Web**. Elas não são aprovação oficial da Igreja, e a interface diz isso onde aparecem.

### Identidade visual

- Fundo claro em tom de pergaminho, verde profundo como cor base e dourado discreto em detalhes.
- Títulos em serifa (Fraunces); texto e cifras continuam em Geist e Geist Mono.
- Barra superior no computador e barra inferior no celular, no lugar da barra lateral.
- As cores litúrgicas (`--liturgy-*`) informam o tempo ou a celebração e aparecem sempre com o nome da cor por extenso.
- A administração (`/admin/catalogo`) mantém formulários mais técnicos, separados da área musical.

## Classificação multidimensional

Uma música do catálogo pode pertencer a vários grupos ao mesmo tempo. A classificação fica em um subdocumento opcional da própria música (`catalog_songs.liturgy`), sem cópia da música por categoria.

| Campo | Conteúdo | Público |
| --- | --- | --- |
| `category` | Tipo de uso (veja "Critérios litúrgicos") | Sim |
| `moments` | Momentos da missa | Sim |
| `seasons` | Tempos para os quais a música é própria | Sim |
| `celebrations` | Celebrações a que a música está ligada | Sim |
| `themes` | Temas | Sim |
| `scripture` | Referências bíblicas estruturadas | Sim |
| `avoidSeasons` | Restrição: tempos em que a música não é sugerida | Sim |
| `suitabilityNotes` | Observações de adequação (até 1000 caracteres) | Sim |
| `officialReference` | Documento oficial que indica o uso do canto, só com evidência específica | Sim |
| `editorialRationale` | Justificativa editorial (até 2000 caracteres; exigida para conferir) | **Não** |
| `guidanceSource` | Fonte de orientação: subsídio, hinário ou rubrica (Etapa 2E.4; exigida para conferir) | Sim |
| `reviewStatus`, `review` | Conferência humana: `pending_review`, `reviewed` ou `disputed`; data e fonte da conferência (Etapa 2E.4) | Data e fonte, sem quem conferiu |
| `dispute` | Nota interna da divergência | **Não** |
| `classifiedBy`, `classifiedAt` | Conta que classificou e quando | **Não** |

### Enum, documento ou associação

- **Momentos e tempos:** listas fechadas no código. São definidos pelo rito e não mudam por decisão editorial.
- **Celebrações e temas:** vocabulários controlados no código (`src/features/liturgy/domain/vocabulary.ts`). Acrescentar um valor é uma mudança revisada e versionada. Se a lista crescer muito ou precisar de edição pela administração, ela pode virar coleção sem mudar o formato gravado nas músicas, que guardam só os identificadores.
- **Associação:** listas de identificadores dentro da música. Não há coleção de junção: a consulta mais comum ("músicas do momento X") é uma igualdade em campo indexado.

### Referências bíblicas

Cada referência é `{ book, chapter, verseStart?, verseEnd? }`, com `book` restrito aos 73 livros do cânon católico. Não são texto livre: é essa estrutura que permite comparar a música com uma leitura da celebração.

- Sem versículos, a referência vale para o capítulo inteiro.
- Dois trechos se relacionam quando têm o mesmo livro e capítulo e versículos em comum.
- Os Salmos são gravados na numeração hebraica (a das Bíblias atuais). A exibição acrescenta a litúrgica: `Sl 22(23)`. Nos casos em que a correspondência não é simples (Sl 9–10, 114–116 e 147), só a numeração hebraica é exibida.

### Validação

O esquema `songClassificationInputSchema` é a fonte única das regras, usado pelo formulário e pelo servidor:

- Todos os valores precisam existir nos vocabulários; repetidos são recusados.
- Canto devocional ou de uso geral não pode ter momentos da missa.
- O mesmo tempo não pode ser indicado e restrito.

Desde a Etapa 2E.4 a classificação pode ser salva incompleta. `missingClassificationParts` aponta o que falta (momento de canto litúrgico, celebração ou passagem do texto próprio, referência do salmo, justificativa e fonte de orientação), e só a classificação completa pode ser conferida por uma pessoa. Toda gravação volta a "não conferida". Detalhes em [catalogo-editorial.md](catalogo-editorial.md#classificação-e-revisão-humana).

Só a administração classifica (`PUT /api/v1/admin/catalog/songs/[id]/classification`, com `If-Match`). A rota grava somente o campo `liturgy`: direitos, situação de publicação e dados musicais não mudam. Músicas anteriores a esta etapa ficam sem classificação até alguém classificá-las; nada é classificado por suposição.

## Momentos litúrgicos

A lista segue a ordem da celebração e distingue o canto que **é** o rito do canto que **acompanha** um rito (IGMR 37).

| Momento | Relação com o rito | IGMR |
| --- | --- | --- |
| Entrada | Acompanha o rito | 47-48 |
| Ato penitencial | É o próprio rito (texto fixo) | 51-52 |
| Glória | É o próprio rito (texto fixo) | 53 |
| Salmo responsorial | É o próprio rito (texto do Lecionário) | 61 |
| Aclamação ao Evangelho | É o próprio rito | 62-63 |
| Preparação das oferendas | Acompanha o rito | 74 |
| Santo | É o próprio rito (texto fixo) | 79b |
| Cordeiro de Deus | É o próprio rito (texto fixo) | 83 |
| Comunhão | Acompanha o rito | 86-87 |
| Ação de graças | Facultativo | 88 |
| Encerramento | Facultativo; a IGMR não prevê canto final | — |

## Tempos e celebrações

- **Tempos:** Advento, Natal, Quaresma, Tríduo Pascal, Páscoa e Tempo Comum, cada um com a cor própria (IGMR 346). O Tríduo não tem cor única.
- **Celebrações:** lista editorial de celebrações com cantos próprios (Natal, Cinzas, Páscoa, Pentecostes, Corpus Christi, Sagrado Coração, Nossa Senhora Aparecida, Cristo Rei, Imaculada Conceição, celebrações de santos, entre outras). Ela serve para classificar músicas e não é o calendário.

## Critérios litúrgicos

Nem toda música religiosa serve à celebração eucarística. A classificação registra o tipo de uso:

| Categoria | Sugestão para a missa |
| --- | --- |
| Canto litúrgico | Sim, nos momentos indicados |
| Canto com texto próprio de uma celebração | Só na celebração ou com a leitura correspondente |
| Canto devocional | Não |
| Música religiosa de uso geral | Não |

Regras por tempo e grau, em `src/features/liturgy/domain/rubrics.ts`:

- **Glória (IGMR 53):** domingos fora do Advento e da Quaresma, solenidades e festas. Nos demais dias, o momento aparece como omitido e nada é sugerido.
- **Aleluia (IGMR 62):** em todos os tempos, exceto na Quaresma. Uma aclamação com Aleluia recebe a restrição "não sugerir na Quaresma".
- **Salmo responsorial (IGMR 61):** é o do Lecionário. Só é sugerida uma música cuja referência bíblica coincida com o salmo da celebração.
- **Santo, Cordeiro de Deus e Ato penitencial:** a interface lembra que o texto é o aprovado.

## Fontes da liturgia

Referências consultadas para as regras: Instrução Geral do Missal Romano (números citados acima) e a estrutura do Lecionário (Ordo Lectionum Missae). A Liturgia Diária das Edições CNBB e o Diretório Litúrgico são as referências oficiais do Brasil para o calendário e as leituras; eles não oferecem acesso programático.

### Investigação de APIs de calendário

| Fonte | Resultado em 11/11/2026 |
| --- | --- |
| Liturgical Calendar API (litcal.johnromanodorazio.com) | Licença Apache-2.0, baseada no Missal de 1970 a 2008. Calendários nacionais só para Vaticano, Canadá, Croácia, Itália, Países Baixos e Estados Unidos. **Sem o Brasil.** Não ficou confirmado que entregue as leituras. |
| CNBB | Não foi encontrada API pública nem termos de reuso dos dados da Liturgia Diária. O aplicativo oficial é protegido por direito autoral. |
| Serviços não oficiais de "liturgia diária" | Reproduzem textos de terceiros sem licença clara. Não usados. |

Conclusão: nenhuma API verificada cobre o calendário brasileiro com leituras e licença adequada. Por isso o MVP usa uma base editorial pequena, atrás de uma interface (`LiturgicalCalendarProvider`) que permite trocar a fonte depois. Calendários do Missal de 1962 não são usados.

### Como cada celebração foi conferida

As referências de cada data foram comparadas com páginas publicadas, registradas em `sources` com o endereço e o que foi conferido:

- **Liturgia Diária da Canção Nova** (reproduz o Lecionário do Brasil): título, cor litúrgica e citações na forma brasileira.
- **USCCB Daily Readings** (mesmo Ordo Lectionum Missae): referências das leituras, do salmo e do Evangelho.
- **Vatican News, "Palavra do dia"** (em português): título e referências das leituras e do Evangelho. A página não traz o salmo.

A conferência foi feita em 11/11/2026 de forma automatizada, durante o desenvolvimento, comparando os dados com essas páginas. **Ela não substitui a revisão por alguém com formação litúrgica**, recomendada antes de qualquer uso público.

## Cobertura real das datas

> **Desde a Etapa 2E.3**, estas 9 celebrações estão em `src/features/liturgy/data/editorial-celebrations.json` e são importadas para o MongoDB por `pnpm liturgy:import`, sempre em revisão. A coluna "Cor" abaixo virou proveniência calculada a partir das fontes: veja [curadoria-liturgica.md](curadoria-liturgica.md#cobertura-real-do-calendário).

A base tinha **9 celebrações**. Não é um calendário completo, e a interface repete isso.

| Data | Celebração | Cor | Fontes | Observação |
| --- | --- | --- | --- | --- |
| 15/11/2026 | 33º Domingo do Tempo Comum (A) | Verde, conferida | Canção Nova, USCCB | |
| 22/11/2026 | Nosso Senhor Jesus Cristo, Rei do Universo (A) | Branco, conferida | Canção Nova, USCCB | |
| 29/11/2026 | 1º Domingo do Advento (B) | Roxo, conferida | Canção Nova, USCCB | |
| 06/12/2026 | 2º Domingo do Advento | Roxo, pela regra | USCCB | |
| 08/12/2026 | Imaculada Conceição | Branco, pela regra | USCCB, Vatican News | |
| 13/12/2026 | 3º Domingo do Advento | Roxo, pela regra | USCCB, Vatican News | Pode-se usar o róseo |
| 20/12/2026 | 4º Domingo do Advento | Roxo, pela regra | Vatican News | **Salmo não conferido** |
| 25/12/2026 | Natal do Senhor, Missa da Noite | Branco, pela regra | Vatican News | **Salmo não conferido**; só um dos quatro formulários |
| 01/01/2027 | Santa Maria, Mãe de Deus | Branco, pela regra | USCCB | |

Regras da base:

- **Data não cadastrada:** `getByDate` devolve `null`. A tela informa a limitação, não mostra leituras, e oferece a liturgia do dia em fonte externa e a busca por momento, tempo e celebração. Nada é calculado nem estimado.
- **Leitura não conferida:** fica em `unverifiedReadings` e aparece como "Não conferido nesta base", com link para a fonte externa. Sem salmo conferido, nenhuma música é sugerida para o salmo.
- **Cor litúrgica:** `basis: "source"` quando conferida na fonte da data; `basis: "rule"` quando vem da regra geral da IGMR 346 para o tempo ou o grau. A tela mostra qual é o caso.
- **Fonte e interpretação:** título, grau, tempo, leituras e cor vêm das fontes. Os temas (`biblicalThemes`) são leitura editorial do Repertório Web, e a tela os identifica assim.
- **Calendário:** `rito-romano-brasil`, idioma `pt-BR`. Um pedido em outro idioma não recebe esses dados por aproximação. As diferenças próprias do Brasil (Epifania e Ascensão no domingo, Corpus Christi na quinta-feira, Nossa Senhora Aparecida) ainda não aparecem porque nenhuma dessas datas está na cobertura.
- **Textos:** só as referências são guardadas. Nenhum texto de leitura é copiado.

## Regras de recomendação

O serviço (`src/features/liturgy/domain/recommendation.ts`) é uma função pura e determinística: as mesmas entradas dão sempre a mesma lista. Não usa IA generativa nem serviço externo.

**Entrada:** a celebração (tempo, grau, leituras, celebrações e temas) e o momento. **Candidatas:** músicas publicadas do catálogo, com classificação de canto litúrgico ou de texto próprio, indicadas para o momento (`listSuggestionCandidates`, sem cifra). Desde a Etapa 2E.4 a consulta já filtra no MongoDB o tempo, as celebrações do dia, as restrições e as classificações em divergência, com limite de 2000 candidatas; a ordem alfabética não decide quem entra.

### 1. Restrições

Aplicadas antes de qualquer ordenação. Uma música barrada aqui nunca aparece, por mais temas que tenha em comum com a celebração.

1. A categoria precisa servir à missa.
2. A música precisa estar indicada para o momento.
3. O momento não pode estar omitido na celebração (Glória no Advento e na Quaresma).
4. O tempo da celebração não pode estar em `avoidSeasons`.
5. Música própria de um tempo ou de uma celebração só aparece neles. Sem tempo nem celebração marcados, ela vale para qualquer celebração.
6. Canto de texto próprio exige a celebração ou a leitura correspondente.
7. No salmo responsorial, a referência da música precisa coincidir com o salmo conferido da celebração.

### 2. Ordem

Entre as elegíveis, nesta prioridade:

1. Momento litúrgico (é condição de entrada).
2. Celebração específica.
3. Relação com as leituras, pela referência bíblica estruturada.
4. Tempo litúrgico.
5. Quantidade de temas em comum.

O desempate é pelo título e depois pelo ID. Coincidência de palavras no título ou na letra nunca gera sugestão.

### 3. Justificativas

Cada sugestão mostra por que apareceu, sempre a partir da classificação cadastrada: "Adequada à Comunhão", "Associada à celebração: Cristo Rei", "Relacionada ao salmo responsorial (Sl 22(23),1-2a.2b-3.5-6)", "Indicada para o Advento", "Relacionada ao tema: misericórdia".

- Sem `officialReference`, a sugestão aparece como **"Sugestão do Repertório Web"**.
- Com `officialReference`, aparece como **"Indicação fundamentada em fonte oficial"**, seguida da fonte informada pela administração.
- Sem música pertinente, o momento informa a ausência de sugestões e oferece a busca manual. Nenhuma música é inventada.

## Direitos autorais

- Classificar não muda os direitos da música. Exibir a cifra e redistribuí-la continuam dependendo de `displayChordPro` e `shareChordPro`.
- A base de celebrações guarda só referências bíblicas, que não são texto protegido.
- As músicas de exemplo do seed são fictícias, escritas para o projeto. Não há exemplos de Glória, Santo, Cordeiro de Deus nem de salmo responsorial, porque esses cantos têm texto litúrgico próprio, cuja tradução oficial pertence à CNBB.
- A justificativa editorial e a evidência de direitos nunca saem da administração.

## Compatibilidade com o catálogo atual

- `liturgy` é opcional. Músicas sem classificação continuam na busca e nos repertórios; só não entram nas sugestões nem nos filtros litúrgicos.
- A busca pública ganhou os filtros `moment`, `season`, `celebration` e `theme`, combináveis entre si e com o texto. Cada resultado traz também `moments` e `seasons`.
- A leitura pública de uma música traz a classificação pública (`liturgy`), sem justificativa nem autoria.
- Direitos, status, revisão e `If-Match` da administração não mudaram.
- Repertórios antigos não são convertidos em repertórios de missa, e seus itens não recebem momento.

### Índices novos

| Coleção | Índice | Finalidade |
| --- | --- | --- |
| `catalog_songs` | `status + liturgy.moments + sortTitle + id` | Filtro e sugestões por momento |
| `catalog_songs` | `status + liturgy.seasons + sortTitle + id` | Filtro por tempo |
| `catalog_songs` | `status + liturgy.celebrations + sortTitle + id` | Filtro por celebração |
| `catalog_songs` | `status + liturgy.themes + sortTitle + id` | Filtro por tema |

Há um índice por dimensão porque o MongoDB não combina dois campos de lista no mesmo índice. Com filtros combinados, um deles é usado e os demais são conferidos nos documentos encontrados.

## Relação entre missa e repertório

Um repertório pode, opcionalmente, guardar a missa a que se destina:

- `repertoire.mass = { date, celebrationId?, title }`. O título é gravado para o repertório não depender da base de celebrações.
- `item.moment`: momento da missa de cada música. O tom e as anotações continuam no item, como antes.
- Uma playlist de ensaio não tem esses campos e continua funcionando.

Fluxo em `/preparar-missa`:

1. Escolher a data e ver a celebração.
2. Ver as sugestões por momento, ou filtrar um momento.
3. Abrir a cifra (o caminho de volta leva à mesma celebração).
4. Criar o repertório da celebração ou continuar um que já exista para a data. Um repertório existente nunca é substituído.
5. Adicionar músicas. Cada uma é salva na hora, como referência ao catálogo, com o momento.
6. Ajustar o tom no painel "Repertório em construção", que fica preso ao rodapé.
7. Revisar na página do repertório, onde também se ordena, anota e compartilha.

Regras:

- Uma música adicionada com momento entra na ordem da missa: depois da última música de momento igual ou anterior. Sem momento, vai para o fim. A ordem continua podendo ser mudada à mão.
- No formulário do repertório, a pessoa pode vincular ou desvincular uma missa. Editar nome e descrição não mexe no vínculo.
- O repertório em construção é identificado no endereço (`?repertorio=`), e nada é guardado no navegador.
- Tudo continua sob `revision` e `If-Match`.

### Compartilhamento

O sistema de snapshots é o mesmo. Um repertório de missa publica também:

- O nome da celebração.
- O momento de cada música.
- A data da celebração, **somente se o proprietário marcar essa opção** ao publicar.

Anotações, a referência interna da celebração, dados de conta e evidências continuam fora. Os direitos das cifras não mudaram. Publicações anteriores mantêm o mesmo conteúdo e o mesmo hash.

### Backup

O arquivo usa a menor versão capaz de guardar o conteúdo:

| Versão | Quando |
| --- | --- |
| 1 | Só músicas particulares |
| 2 | Há músicas do catálogo (origem de cada item) |
| 3 | Algum repertório tem missa ou momento litúrgico |

As três versões são aceitas na importação. Um arquivo das versões 1 ou 2 que traga dados de missa é recusado.

## Contratos HTTP desta etapa

> **Etapa 2E.3:** `GET /api/v1/liturgy/celebrations` sem data passou a ser uma busca paginada (não há mais `coverage`), a consulta por data devolve também as variantes (`celebrations`), e as sugestões trazem `assurance` e `cautions`. Os contratos atuais estão em [curadoria-liturgica.md](curadoria-liturgica.md#contratos-http).

Públicos, sem sessão (`Cache-Control: no-store`, mesmo limite de requisições do catálogo):

| Rota | Resposta |
| --- | --- |
| `GET /api/v1/liturgy/celebrations` | `{ coverage }`: as datas disponíveis |
| `GET /api/v1/liturgy/celebrations?date=AAAA-MM-DD` | `{ celebration }`, ou 404 se a data não estiver coberta |
| `GET /api/v1/liturgy/suggestions?date=...&moment=...` | `{ celebration, assurance, cautions, moments, catalog }`, com sugestões, justificativas, a conferência de cada classificação (`classification`) e a cobertura do catálogo (`catalog`, `classifiedForMoment`); `moment` é opcional |
| `GET /api/v1/admin/liturgy/celebrations/:id/diagnostics` | Só administração: por momento, classificadas, elegíveis, conferidas, com cifra e descartes por regra (Etapa 2E.4) |
| `GET /api/v1/catalog/songs?moment=&season=&celebration=&theme=` | Busca com filtros litúrgicos; valor fora do vocabulário responde 400 |

Administração: `PUT /api/v1/admin/catalog/songs/[id]/classification`, com `{ liturgy }` (ou `null` para remover) e `If-Match`.

Biblioteca: `POST .../repertoires` e `PUT .../repertoires/[id]` aceitam `mass`; `POST .../items` aceita `moment`; `PATCH .../items/[itemId]` aceita `moment` (ou `null`); a seleção de compartilhamento aceita `includeMassDate`.

## Dados de exemplo

`pnpm catalog:seed` (só desenvolvimento, idempotente) passou a inserir dez cantos fictícios com classificação: entrada, entrada do Advento, preparação das oferendas, comunhão, comunhão de Cristo Rei, canto penitencial da Quaresma, canto pascal, aclamação com Aleluia, encerramento e um canto devocional. As cinco músicas de exemplo anteriores continuam sem classificação. Os metadados das celebrações não fazem parte do seed: são a base editorial descrita acima.

## Testes

- **Unitários:** vocabulários e referências bíblicas, regras da classificação, base de celebrações (data coberta, data ausente, calendário brasileiro, origem, leitura não conferida, fonte e interpretação), normas por tempo, elegibilidade, ordem, justificativas, repertório de missa, backup versão 3, snapshot com missa e as telas (planejador, filtros, editor de classificação, repertório e link público).
- **Integração** (`tests/integration/liturgy.test.ts`, MongoDB real): classificação pela administração, filtros combinados, índices, calendário e sugestões, repertório da missa, compartilhamento e backup.

## Plano para o calendário automático

> **Etapa 2E.3:** os passos 2 (provedor) e 4 (revisão humana registrada) foram feitos. A investigação de fontes e os próximos passos estão em [curadoria-liturgica.md](curadoria-liturgica.md#integração-automatizada-viabilidade).

1. **Fonte.** Obter uma fonte verificada do calendário do Brasil: licença ou parceria com a CNBB para os dados da Liturgia Diária, ou contribuir com o calendário nacional do Brasil para a Liturgical Calendar API.
2. **Provedor.** Implementar outro `LiturgicalCalendarProvider`. A base editorial pode continuar como primeira consulta, com a API como complemento.
3. **Leituras.** Se a fonte não trouxer as leituras, manter o Lecionário como tabela própria, revisada por pessoa com formação litúrgica, com os ciclos A, B e C e as particularidades do Brasil.
4. **Revisão.** Registrar quem revisou cada celebração e quando, separando revisão humana de conferência automatizada.
5. **Regras.** Estender as normas para o Tríduo Pascal, as memórias e os dias de semana antes de cobri-los.
6. **Calendários locais.** `calendar` e `locale` já fazem parte do contexto, para calendários diocesanos no futuro.

## Limitações

- A cobertura é de 9 datas. Fora delas não há contexto litúrgico.
- Dois salmos não foram conferidos (20/12 e 25/12/2026), e o Natal tem só a Missa da Noite.
- A conferência das celebrações foi automatizada. Desde a Etapa 2E.3 elas aparecem como "em revisão" até uma pessoa da administração aprová-las.
- As sugestões dependem da classificação feita pela administração. Uma música mal classificada é mal sugerida.
- Acima de 2000 candidatas já filtradas para o momento, o tempo e as celebrações do dia, as últimas por título não são consideradas.
- Classificações não conferidas também geram sugestões, sempre marcadas como não conferidas e com o resultado provisório.
- O Tríduo Pascal, as memórias e os dias de semana não têm regras próprias.
- Celebrações e temas são listas no código: ampliá-las exige uma nova versão.
- Não há reprodução de áudio nem links de escuta nesta etapa.
