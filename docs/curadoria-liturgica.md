# Curadoria do calendário litúrgico

Etapa 2E.3. Este documento descreve como as celebrações passaram a ser dados editoriais no MongoDB: o modelo, as fontes, o processo de revisão, a auditoria, a administração, a cobertura real e o que falta para um calendário automático. A visão geral do produto, a classificação das músicas e as regras de recomendação da Etapa 2E.2 continuam em [arquitetura-liturgica.md](arquitetura-liturgica.md).

## Princípios

- **Nada é inventado.** Uma data sem celebração cadastrada não recebe leituras, cor nem título estimados. Uma leitura que ninguém conferiu aparece como "não conferida".
- **Fato, inferência e interpretação ficam separados.** O que uma fonte confirma é fato. O que vem de regra geral (por exemplo, a cor do tempo) é inferência. Os temas bíblicos são interpretação editorial.
- **Conferência automatizada não é revisão.** Toda celebração importada ou criada começa em revisão. Só uma pessoa da administração aprova, declarando que conferiu nas fontes.
- **Aprovação não sobrevive a mudança.** Editar o conteúdo de uma celebração revisada devolve a celebração à revisão.
- **Sem texto litúrgico.** Só referências bíblicas e metadados. Nenhum texto de leitura é copiado.

## Modelo editorial

Coleção `liturgical_celebrations`. Cada documento é uma celebração em uma data, para um calendário.

| Campo | Conteúdo |
| --- | --- |
| `id` | Identificador estável. Nunca é o título. As nove celebrações da Etapa 2E.2 mantêm os IDs que os repertórios já guardavam. |
| `date` | Data civil `AAAA-MM-DD`, guardada como texto. Não é um timestamp: não muda de dia por fuso horário. |
| `country` | `BR`. |
| `scope` | `universal` (calendário romano geral), `national` (calendário do Brasil) ou `diocesan`. |
| `diocese` | Só em celebração diocesana. |
| `celebrationKey` | Identifica a celebração no calendário (ex.: `cristo-rei`, `natal-do-senhor`). |
| `massVariant` | Formulário: `principal`, `vigilia`, `noite`, `aurora` ou `dia`. |
| `title`, `rank`, `season` | Título, grau (solenidade, festa, domingo, memória, memória facultativa, dia de semana) e tempo litúrgico. |
| `lectionaryCycle` | Ano dominical (A, B, C) e ciclo ferial (I, II), que não se aplica a domingos e solenidades. |
| `liturgicalColor` | Cor e observação. Se é fato ou inferência, depende das fontes (veja "Proveniência"). |
| `readings` | Leituras conferidas: papel, citação como no Lecionário e trechos estruturados. |
| `unverifiedReadings` | Leituras que a celebração tem, mas que ninguém conferiu. |
| `celebrations`, `biblicalThemes`, `notes` | Leitura editorial: celebrações do vocabulário (para cantos próprios), temas e observações. |
| `sources` | Fontes, com o que cada uma confirma. |
| `reviewStatus`, `approval`, `dispute` | Estado editorial, aprovação em vigor e divergência aberta. |
| `revision`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | Controle de versão e autoria. |

### Unicidade e variantes

- Índice único em `country + dioceseKey + date + celebrationKey + massVariant`. `dioceseKey` é a diocese, ou texto vazio no calendário nacional.
- Uma data pode ter várias celebrações. O Natal, por exemplo, pode ter quatro formulários. A consulta por data devolve todas, na ordem dos formulários e da abrangência.
- A tela pública mostra um seletor quando a data tem mais de uma celebração. A escolha fica no endereço (`?celebracao=`).
- A consulta pública devolve o calendário nacional e o universal. O modelo aceita particularidades diocesanas, mas a precedência entre diocese e país ainda não foi implementada: uma celebração diocesana só aparece quando a consulta pede essa diocese.
- **Missa vespertina e vigília:** a data da celebração é a do dia litúrgico. O aplicativo não converte sábado à noite em domingo. A pessoa escolhe a data da celebração que vai preparar, e a vigília é um formulário próprio, quando cadastrado.

### Proveniência

Cada fonte registra:

| Campo | Conteúdo |
| --- | --- |
| `provider`, `documentTitle` | Quem publica e qual documento. |
| `referenceUrl` | Endereço, quando existe. |
| `edition` | Edição, quando conhecida. Não é preenchida por suposição. |
| `accessedAt` | Data da consulta. |
| `jurisdiction` | `BR` (fonte do Brasil), `universal` ou `other-country`. |
| `scope` | O que a fonte confirma: título, grau, tempo, cor, ciclo e cada leitura. |
| `verificationStatus` | `automated-comparison` (comparação automatizada) ou `human-check` (conferida por pessoa). |
| `note` | Observação, como a ressalva de que a fonte é de outro país. |

Regras, validadas no formulário, na importação e no servidor:

- Toda celebração precisa de pelo menos uma fonte.
- Toda leitura registrada precisa de uma fonte que a confirme. Sem fonte, a leitura fica "não conferida".
- **Uma fonte de outro país nunca confirma o calendário do Brasil.** Ela pode confirmar só referências de leituras, porque o Lecionário é comum. Assim, a USCCB (Estados Unidos) não serve de fonte para título, grau, tempo ou cor.

A proveniência de cada fato é calculada (`computeProvenance`):

- **Fonte:** uma fonte válida confirma o fato.
- **Inferência:** nenhuma fonte confirma. A cor, por exemplo, segue a regra geral da IGMR 346.
- **Não conferido:** a leitura existe, mas não foi conferida.

A tela pública lista o que não foi confirmado em fonte do Brasil ou universal e, em "Fontes e conferência", de onde vem cada dado.

## Processo de revisão

| Estado | Significado na tela pública |
| --- | --- |
| `pending_review` | "Dados em revisão": conferidos nas fontes, ainda sem revisão humana. |
| `reviewed` | "Celebração revisada" pela equipe do Repertório Web, com data. Uma revisão editorial, não uma publicação oficial. |
| `disputed` | "Dados com divergência", com os campos em divergência. A nota é interna. |
| `needs_update` | "Dados em atualização": revisada antes, precisa ser atualizada. |

Transições (`src/features/liturgy/domain/review.ts`):

| De | Ação | Para | Exige |
| --- | --- | --- | --- |
| `pending_review` | aprovar | `reviewed` | Confirmação de conferência humana e as fontes usadas |
| `needs_update` | aprovar | `reviewed` | Idem |
| `pending_review`, `reviewed`, `needs_update` | registrar divergência | `disputed` | Campos e observação |
| `disputed` | resolver | `pending_review` | Observação |
| `reviewed` | reabrir | `needs_update` | Observação |
| qualquer | editar conteúdo | `pending_review` (ou continua `disputed`) | Revisão atual (`If-Match`) |

- **Ninguém aprova sem declarar conferência humana.** O pedido precisa de `humanReviewConfirmed: true` e das fontes registradas que fundamentam a aprovação. A importação e a edição nunca aprovam.
- **A aprovação guarda** quem aprovou, quando, a revisão de conteúdo aprovada e as fontes. Ela existe só enquanto a celebração está revisada.
- **Editar apaga a aprovação.** Ela continua no histórico, e a celebração volta à revisão.
- **Uma divergência impede nova aprovação** até ser resolvida.
- Toda ação usa `revision` e `If-Match`: uma revisão desatualizada responde 412 e nada é gravado.

## Auditoria

Coleção `liturgical_celebration_history`, gravada na mesma transação de cada alteração. Cada registro guarda:

- A celebração e a ação (importação, criação, edição, aprovação, divergência, resolução, reabertura).
- A revisão anterior e a nova, e o estado anterior e o novo.
- Os campos alterados.
- O responsável: o ID da conta administradora, ou `importacao-editorial`.
- A data e a observação, quando houver.
- Na aprovação, a revisão aprovada e as fontes.
- Nas ações que mudam conteúdo, o conteúdo resultante.

Nada de sessão, e-mail ou dados de conta além do ID. O conteúdo por revisão permite reconstruir o que a celebração dizia quando uma sugestão foi mostrada: a resposta de sugestões informa a revisão e o estado da celebração usados. O histórico é exclusivo da administração (`GET /api/v1/admin/liturgy/celebrations/[id]/history`) e mostra até 200 registros. Não é uma plataforma de auditoria para o sistema inteiro.

## Administração

`/admin/liturgia`, acessível só a contas com o papel administrativo, concedido pelo comando `pnpm catalog:admin`. Não há rota de autoelevação, e o cadastro comum nunca concede o papel.

- **Lista:** busca por título e por período, filtros por situação e tempo litúrgico, paginada.
- **Nova celebração:** formulário completo. A celebração nasce em revisão.
- **Edição:**
  - Identificação, calendário e leituras (registrada, não conferida ou não se aplica, com trechos estruturados).
  - Leitura editorial (celebrações do vocabulário, temas e observações).
  - Fontes, com o que cada uma confirma.
- **Revisão:**
  - Estado, aprovação em vigor e divergência.
  - O que não tem fonte e o que não foi conferido.
  - Ações permitidas no estado atual.
  - A revisão fica bloqueada enquanto houver alterações não salvas no conteúdo.
- **Histórico** de alterações.
- **Qualidade do catálogo** (`/admin/catalogo/qualidade`): músicas sem classificação, sem momento, sem justificativa, com classificação contraditória ou publicadas sem condição de receber sugestões. Só aponta: nada é preenchido automaticamente, e os direitos não mudam.

## Importação editorial

As nove celebrações da Etapa 2E.2 estão em `src/features/liturgy/data/editorial-celebrations.json`, validadas pelos testes unitários com as regras do domínio.

```bash
docker compose exec app pnpm liturgy:import
```

- Só por comando explícito. O banco principal não é alterado automaticamente.
- Recusa `NODE_ENV=production`.
- **Idempotente:** insere só o que falta. Uma celebração existente nunca é alterada, nem se tiver sido editada ou aprovada.
- Toda celebração importada começa em `pending_review`, com revisão 1, e registra "Importação editorial" no histórico.
- Os salmos de 20/12 e 25/12/2026 continuam não conferidos.
- Sem a importação, o calendário fica vazio: a tela informa que a data não está cadastrada, e nenhuma leitura aparece.

## Cobertura real do calendário

Em 14/11/2026, a base editorial tem **9 celebrações**, entre 15/11/2026 e 01/01/2027, todas **em revisão** (nenhuma aprovação humana).

| Data | Celebração | Confirmado em fonte do Brasil ou universal | Só inferência |
| --- | --- | --- | --- |
| 15/11/2026 | 33º Domingo do Tempo Comum | Título, grau, tempo, cor, 4 leituras | Ciclo |
| 22/11/2026 | Cristo Rei | Título, grau, cor, 4 leituras | Tempo, ciclo |
| 29/11/2026 | 1º Domingo do Advento | Título, grau, tempo, cor, 4 leituras | Ciclo |
| 06/12/2026 | 2º Domingo do Advento | — (leituras só pela USCCB) | Título, grau, tempo, cor, ciclo |
| 08/12/2026 | Imaculada Conceição | Título, grau, tempo, 1ª e 2ª leituras, Evangelho | Cor, ciclo |
| 13/12/2026 | 3º Domingo do Advento | Título, grau, tempo, 1ª e 2ª leituras, Evangelho | Cor, ciclo |
| 20/12/2026 | 4º Domingo do Advento | Título, grau, tempo, 1ª e 2ª leituras, Evangelho | Cor, ciclo; **salmo não conferido** |
| 25/12/2026 | Natal do Senhor, Missa da Noite | Título, grau, tempo, 1ª e 2ª leituras, Evangelho | Cor, ciclo; **salmo não conferido** |
| 01/01/2027 | Santa Maria, Mãe de Deus | — (leituras só pela USCCB) | Título, grau, tempo, cor, ciclo |

Nas linhas marcadas com "—", as leituras foram confirmadas pela USCCB, que vale só como fonte de leituras. A Missa da Noite do Natal foi identificada pelas leituras: a fonte não indica o formulário.

## Fontes

### Prioritárias, para a revisão humana

| Fonte | Uso |
| --- | --- |
| Diretório da Liturgia e da Organização da Igreja no Brasil (CNBB, anual) | Calendário nacional: celebrações, graus, cores, transferências e particularidades do Brasil |
| Liturgia Diária (Edições CNBB) | Leituras e salmo na forma do Lecionário brasileiro |
| Instrução Geral do Missal Romano | Regras: Glória (53), salmo (61), Aleluia (62), cores (346) |
| Lecionário (Ordo Lectionum Missae) | Ciclos A, B, C e I, II; leituras por celebração |

### Usadas na conferência automatizada da Etapa 2E.2

| Fonte | Abrangência | Uso permitido no modelo |
| --- | --- | --- |
| Canção Nova, Liturgia Diária | Brasil | Calendário e leituras |
| Vatican News, Palavra do dia (pt) | Universal | Calendário e leituras; não traz o salmo |
| USCCB, Daily Bible Readings | Estados Unidos | Só referências de leituras |

## Integração automatizada: viabilidade

Investigação feita entre 11 e 14/11/2026. Nenhuma fonte foi integrada.

| Fonte | Cobertura | Calendário do Brasil | Licença | Formato | Conclusão |
| --- | --- | --- | --- | --- | --- |
| Liturgical Calendar API (litcal.johnromanodorazio.com) | Missal de 1970 a 2008, calendário geral e alguns países | **Não**: calendários nacionais do Vaticano, Canadá, Croácia, Itália, Países Baixos e EUA | Apache-2.0 | JSON | Não serve como calendário brasileiro. Contribuir com um calendário nacional do Brasil é um caminho possível. Não ficou confirmado que entregue as leituras. |
| CNBB / Liturgia Diária | Brasil, leituras completas | Sim | Não encontramos API pública nem termos de reuso; o aplicativo é protegido por direito autoral | Aplicativo e páginas | Exige parceria ou licença. `liturgiadiaria.cnbb.org.br` falhou na conexão TLS em 11/11/2026. |
| Diretório da Liturgia (CNBB) | Brasil, ano inteiro | Sim | Publicação protegida | Impresso / PDF | Não há formato estruturado conhecido. Serve à revisão humana. |
| Canção Nova | Brasil, mês corrente | Sim | Termos de reuso não verificados | HTML | Sem API. Raspar páginas sem autorização está fora de questão. |
| Vatican News | Universal, poucos dias à frente | Parcial | Termos de reuso não verificados | HTML | Sem salmo e sem calendário nacional. |
| USCCB | EUA | Não | Termos não verificados; bloqueou após poucas consultas | HTML | Não pode ser usada como calendário do Brasil. |

**Conclusão:** nenhuma fonte confirmada reúne calendário brasileiro, leituras, cobertura e licença adequada. Por isso:

- A base continua editorial, com revisão humana.
- `LiturgicalCalendarProvider` permite trocar a fonte sem mudar quem consome.
- Nenhuma API externa é consultada ao abrir uma página.

**Próximos passos possíveis:**
- Pedir à CNBB licença ou acesso aos dados do Diretório e da Liturgia Diária.
- Contribuir com o calendário nacional do Brasil para a Liturgical Calendar API e, depois, usá-la só para datas e graus, com leituras e revisão sempre na base editorial.

## Regras de recomendação nesta etapa

O algoritmo da Etapa 2E.2 é o mesmo. O que mudou foi a separação dos critérios e o efeito do estado editorial:

- **Elegibilidade litúrgica:** categoria, momento, momento omitido (Glória), restrição de tempo, música própria de um tempo ou celebração, texto próprio e salmo do Lecionário. Uma música barrada nunca aparece, por mais temas que tenha.
- **Correspondências:** cada sugestão traz `matches` (celebrações, leituras, tempo e temas) e `priority` (a tupla usada na ordem), além das justificativas em texto.
- **Estado editorial:** a resposta traz `assurance` (`definitive` ou `provisional`) e `cautions`. As sugestões são provisórias quando a celebração não está revisada, quando há divergência ou quando falta leitura conferida.
- **Leitura em divergência** não é usada: nem para correspondência bíblica nem para o salmo.
- **Salmo não conferido:** nenhuma música é sugerida no lugar.
- **Cantos próprios do rito** (Glória, Santo, Cordeiro, salmo, aclamação) só recebem músicas classificadas para aquele momento. Semelhança de tema nunca substitui o canto próprio.
- Música despublicada, rascunho ou sem classificação não é sugerida.

## Repertórios

- Um repertório criado na preparação da missa guarda a revisão da celebração (`mass.celebrationRevision`).
- Na página do repertório aparecem a situação atual da celebração e, se ela mudou depois, um aviso. As músicas, os tons, as anotações e a ordem nunca mudam por causa de uma revisão.
- Repertórios antigos, sem celebração vinculada, não consultam nada e continuam como estavam.

## Direitos autorais

- Só metadados e referências bíblicas. O texto das leituras e dos salmos não é copiado nem baixado.
- As citações transcritas da USCCB estão no formato brasileiro, com a ressalva registrada na fonte.
- Nenhuma página é raspada automaticamente. A conferência da Etapa 2E.2 foi feita durante o desenvolvimento, uma página por vez, só para comparar referências.
- As músicas e as celebrações de teste são fictícias e marcadas como tais.

## Contratos HTTP

Públicos, sem sessão, `Cache-Control: no-store` (uma revisão vale na próxima leitura):

| Rota | Resposta |
| --- | --- |
| `GET /api/v1/liturgy/celebrations?date=AAAA-MM-DD` | `{ celebration, celebrations }`: a primeira e todas as variantes da data. 404 sem cobertura. |
| `GET /api/v1/liturgy/celebrations?from=&to=&q=&season=&status=&page=&pageSize=` | Busca paginada (até 50 por página e 366 dias por período). |
| `GET /api/v1/liturgy/celebrations/[id]` | `{ celebration }`. |
| `GET /api/v1/liturgy/suggestions?date=&celebration=&moment=` | `{ celebration, assurance, cautions, moments }`. |

As respostas públicas não trazem autoria, nota de divergência, histórico nem campos de controle internos.

Administração (papel administrativo; `If-Match` nas alterações):

| Rota | Métodos |
| --- | --- |
| `/api/v1/admin/liturgy/celebrations` | GET (busca), POST |
| `/api/v1/admin/liturgy/celebrations/[id]` | GET, PUT |
| `/api/v1/admin/liturgy/celebrations/[id]/review` | POST (`approve`, `dispute`, `resolve`, `reopen`) |
| `/api/v1/admin/liturgy/celebrations/[id]/history` | GET |
| `/api/v1/admin/catalog/quality` | GET |

## Índices

| Coleção | Índice | Finalidade |
| --- | --- | --- |
| `liturgical_celebrations` | `id` (único) | Identidade |
| `liturgical_celebrations` | `country + dioceseKey + date + celebrationKey + massVariant` (único) | Uma celebração por formulário, data e calendário |
| `liturgical_celebrations` | `date + id` | Consulta por data e por período |
| `liturgical_celebrations` | `reviewStatus + date` | Filtro por situação |
| `liturgical_celebrations` | `season + date` | Filtro por tempo |
| `liturgical_celebrations` | `searchTokens + date` | Busca pelo título (prefixo de palavra) |
| `liturgical_celebration_history` | `id` (único); `celebrationId + toRevision` | Histórico por celebração |

## Testes

- **Unitários:**
  - Datas civis e fuso horário.
  - As nove celebrações e sua proveniência.
  - Regras do modelo: identificação, variantes, país e diocese, fonte obrigatória, leitura com fonte, fonte de outro país.
  - Projeção pública sem dados internos e campos alterados.
  - Transições de revisão e busca.
  - Recomendações condicionadas ao estado editorial.
  - Qualidade do catálogo.
  - Telas: estados A a D, sugestões provisórias, aviso no repertório e administração.
- **Integração** (`tests/integration/liturgy-calendar.test.ts`, MongoDB real):
  - A: importação.
  - B: revisão.
  - C: autorização.
  - D: calendário.
  - E: recomendação.
  - F: regressão do repertório da missa e do compartilhamento.

## Limitações

- A cobertura é de 9 datas, nenhuma revisada por pessoa.
- Não há regras para o Tríduo Pascal, memórias e dias de semana, nem transferências de celebrações calculadas: tudo é cadastrado.
- A precedência entre calendário diocesano e nacional não foi implementada.
- Celebrações e temas continuam como vocabulários no código.
- O histórico mostra até 200 registros por celebração.
- Os títulos das fontes (`documentTitle`) da importação são os nomes das seções dos sites, porque o título exato de cada página não foi registrado na conferência.
