# Catálogo central de músicas

Etapa 2E.1. Este documento descreve o catálogo global: o modelo, as regras de direitos, a busca, a administração e como ele se combina com repertórios, links públicos e backups.

> **Etapa 2E.2:** as músicas do catálogo passaram a ter classificação litúrgica opcional (`liturgy`), a busca ganhou filtros por momento, tempo, celebração e tema, e os resultados trazem `moments` e `seasons`. Os detalhes estão em [arquitetura-liturgica.md](arquitetura-liturgica.md). O que está descrito abaixo continua válido.

## Objetivo

O catálogo é um acervo único da plataforma, mantido pela administração, que qualquer pessoa pode consultar e que contas autenticadas podem usar nos seus repertórios. Ele não substitui as músicas particulares: cada conta continua com a sua biblioteca própria, e um repertório pode misturar as duas origens.

O catálogo só publica conteúdo com fundamento de direitos registrado. Nada é importado de sites externos e não há scraping.

## Modelo `CatalogSong`

Coleção `catalog_songs`. Os campos musicais e suas regras (título, artista, tom, tipo de conteúdo, ChordPro, link externo) são os mesmos das músicas particulares e passam pelo mesmo esquema Zod (`songInputSchema`).

| Campo | Descrição |
| --- | --- |
| `id` | Identificador estável (UUID para músicas criadas na administração; ID legível no seed). |
| `title`, `artist`, `originalKey`, `contentType` | Iguais aos da música particular, mais o tipo `metadata-only` (Etapa 2E.4), em que o artista pode ficar vazio e o tom é opcional. |
| `chordPro` | Opcional. Nunca existe em `external-link` nem em `metadata-only`. |
| `compositionReference`, `metadataSources` | Referência da composição e fontes consultadas (título, endereço, data). Públicas. |
| `importKey` | Chave da importação editorial, com índice único parcial. Só nas músicas importadas. |
| `sourceUrl` | Somente em `external-link`, `http(s)`. |
| `status` | `draft`, `published` ou `unpublished`. |
| `rights.basis` | `original-work`, `license`, `author-permission`, `public-domain`, `external-reference` ou `public-metadata`. |
| `rights.evidence` | Texto interno (até 2000 caracteres). Nunca sai da administração. Pode ficar vazio no rascunho; é exigido para publicar. |
| `rights.displayChordPro` | Permite exibir a cifra no catálogo. |
| `rights.shareChordPro` | Permite incluir a cifra em links públicos de repertórios. Exige `displayChordPro`. |
| `rights.linkExternalSource` | Permite mostrar o link de `external-link`. Ausente nas músicas antigas, vale como permitido. |
| `rights.approvedBy`, `rights.approvedAt` | Conta que aprovou os direitos e quando. Mantidos enquanto os direitos não mudam. |
| `revision` | Controle de concorrência da administração (`If-Match`). |
| `createdAt`, `updatedAt`, `publishedAt` | `publishedAt` é a primeira publicação e não muda depois. |
| `searchTokens`, `sortTitle` | Derivados, só para busca e ordenação. Nunca saem do servidor. |

Não há `ownerId`: a música global não pertence a nenhuma conta.

O tipo **Autorizada** sozinho não libera nada. Só `displayChordPro` e `shareChordPro`, marcados pela administração, permitem exibir ou redistribuir a cifra. Em `external-link` e `metadata-only` as duas marcações são sempre falsas.

Cadastro em etapas, músicas só com metadados, classificação conferida e importação de metadados estão em [catalogo-editorial.md](catalogo-editorial.md).

Desde a Etapa 2F.1, uma música pode ter `video` (YouTube: provedor e identificador, aprovado pela administração) e `contributions` (propostas aceitas, campos aplicados, crédito público e licença declarada). A projeção pública expõe só `video { provider, videoId, title?, startSeconds? }` e `contributorCredit`. O início em segundos, opcional, é cadastrado na administração; a busca e as sugestões da Missa também recebem a referência pública para ouvir pelos cartões. Veja [contribuicoes-catalogo.md](contribuicoes-catalogo.md).

## Música global e música particular

| | Catálogo | Particular |
| --- | --- | --- |
| Coleção | `catalog_songs` | `songs` |
| Dono | Nenhum (plataforma) | `ownerId` da conta |
| Quem edita | Administração | O dono |
| Quem lê | Qualquer pessoa, se publicada | Somente o dono |
| Cifra em link público | Se `shareChordPro` | Se o dono confirmar a declaração de direitos |
| Exclusão | Não há; despublica-se | Bloqueada enquanto estiver em repertório |

Uma música do catálogo nunca é copiada para a biblioteca da conta, e uma música particular nunca vira global.

## Referências nos repertórios

Cada item de repertório guarda `source: "catalog" | "personal"` e `songId`. Tom (`transposeSemitones`) e anotações continuam no item, então a mesma música do catálogo pode ter um tom diferente em cada repertório. A cifra não é copiada.

- **Catálogo:** só músicas publicadas podem ser adicionadas. Rascunho, despublicada ou inexistente respondem 409 (`catalog-song-unavailable`).
- **Particular:** só músicas da própria conta. A música de outra conta responde como inexistente (404).
- **Duplicidade:** é verificada por origem e ID.
- **Resolução:** `resolveSongReferences` busca todas as referências de uma listagem com no máximo uma consulta por origem, sem N+1. As particulares são filtradas pelo dono; as do catálogo são filtradas por `status: "published"` antes de chegar ao usuário.
- **Exclusão de música particular:** o bloqueio "em uso" considera somente itens de origem particular.

`GET /api/v1/library/repertoires` responde `{ repertoires, catalogSongs }`. `catalogSongs` traz apenas as músicas publicadas usadas pelos repertórios da conta, já com a cifra filtrada pelos direitos de exibição.

## Compatibilidade com dados legados

- Itens gravados antes desta etapa não têm `source`. Eles são lidos como `personal`, sem migração destrutiva no banco. A primeira gravação do repertório passa a guardar o campo.
- A biblioteca antiga do navegador e os backups com `schemaVersion: 1` também são lidos como particulares. Um arquivo versão 1 que diga `source: "catalog"` é recusado.
- O hash de idempotência da importação ignora `source: "personal"`, então repetir uma importação antiga continua reconhecido como a mesma.

## Busca

`GET /api/v1/catalog/songs?q=&page=&pageSize=`

- Título e artista, sem diferenciar maiúsculas, acentos ou espaços extras. A pontuação separa palavras.
- Cada termo encontra o **começo** de uma palavra do título ou do artista (`coraç` encontra "Coração"; `ação` não). Todos os termos precisam ser encontrados.
- Consulta vazia lista o catálogo.
- Ordem determinística: título normalizado e, em empate, `id`.
- Até 12 termos por consulta e 100 caracteres. `pageSize` de 1 a 24 (padrão 12) e `page` de 1 a 50.
- Os termos são escapados e ancorados (`^termo`) sobre `searchTokens`, com índice. Não há expressão regular sem âncora, nem `$where` ou busca textual.
- A resposta traz só os campos da listagem (`id`, `title`, `artist`, `originalKey`, `contentType`, `hasChordPro`), sem cifra, direitos ou estado.

## Administração

### Quem administra

O papel fica na coleção `catalog_admins` (`userId` único, `grantedAt`, `grantedBy`, `note`). Ele é lido do banco a cada requisição e página.

- Não há rota HTTP para conceder o papel, nem papel enviado pelo cliente, nem senha fixa, nem lista de e-mails em configuração.
- O cadastro comum nunca concede o papel, e o primeiro usuário não vira administrador.
- Páginas `/admin/catalogo/*`: sem sessão, redirecionam para o login; sem o papel, respondem 404. As rotas `/api/v1/admin/*` respondem 401 sem sessão e 403 sem o papel.

### Conceder ou revogar o papel

É feito por linha de comando, com acesso direto ao banco. A conta precisa existir.

```bash
# Com Docker
docker compose exec app pnpm catalog:admin grant --email pessoa@exemplo.com --note "motivo"
docker compose exec app pnpm catalog:admin revoke --email pessoa@exemplo.com
docker compose exec app pnpm catalog:admin list

# Sem Docker (lê MONGODB_URI e MONGODB_DB_NAME do ambiente ou do .env)
pnpm catalog:admin grant --email pessoa@exemplo.com
```

A revogação vale na requisição seguinte.

### Edição

Em **Minha conta → Administrar catálogo** (`/admin/catalogo`), visível só para administradores:

- Lista com filtro por situação, incluindo rascunhos.
- Criar rascunho, editar dados musicais, cifra ou link e revisar direitos.
- Publicar e despublicar.
- Cada gravação envia a revisão carregada. Uma versão alterada por outra pessoa responde 412 e nada é sobrescrito.
- O **tom original** fica travado depois da primeira publicação. Os repertórios guardam o deslocamento em semitons a partir dele, e mudá-lo alteraria o tom de todos. A tentativa responde 400.
- Não há exclusão física. Para retirar uma música, despublique-a.

## Política de direitos

1. Toda música tem fundamento (`basis`) e evidência registrados por uma conta administradora, com data.
2. Exibir a cifra no catálogo exige `displayChordPro`.
3. Incluir a cifra em links públicos exige também `shareChordPro`.
4. Sem `displayChordPro`, o catálogo mostra só título, artista e tom (quando conhecido), e a cifra não sai do servidor.
5. Link externo leva só ao endereço, nunca a uma cópia, e só com `linkExternalSource`. Sem essa permissão, a música aparece só com metadados.
6. A classificação litúrgica não concede direito algum, e subsídios da CNBB ou de dioceses não são licença geral de reprodução.
7. A evidência, quem aprovou e a revisão nunca aparecem em respostas públicas, em repertórios nem em links compartilhados.

## Publicação e despublicação

- **Rascunho:** invisível fora da administração. Não pode ser adicionado a repertórios.
- **Publicar:** a música aparece na busca, na leitura pública e pode ser adicionada.
- **Despublicar:**
  - A música some da busca e a leitura pública responde 404.
  - Ninguém consegue adicioná-la de novo.
  - **Os repertórios que já a usam não são alterados.** O item, o tom e as anotações continuam salvos. Na tela ele aparece como "Música indisponível no catálogo", sem título nem cifra, e pode ser removido normalmente.
  - Links públicos passam a mostrar a música como indisponível (veja abaixo).
  - Backups ainda guardam a referência. Restaurá-los em outra conta é recusado enquanto a música não voltar a ser publicada.
- **Republicar:** a música volta a aparecer nos mesmos repertórios, com os tons já escolhidos.

## Interação com links públicos (snapshots)

Ao publicar ou atualizar um link de repertório:

- **Particular:** a cifra entra somente com a declaração de direitos do dono, como antes.
- **Catálogo:** a decisão é da plataforma. A cifra entra se a música estiver publicada e tiver `shareChordPro`. A confirmação do dono não libera música do catálogo. Sem permissão, o item entra só com título, artista e tom.
- **Link externo:** somente o endereço.
- Anotações, IDs internos, dono, evidências e dados administrativos nunca entram.

O snapshot guarda, fora do conteúdo público, a origem de cada item. **A cada leitura pública**, os itens do catálogo são conferidos de novo contra o catálogo atual, sem depender de cache:

- Música despublicada: o item mostra apenas o título, com "Esta música não está mais disponível neste link".
- `shareChordPro` revogado: a cifra deixa de ser entregue da mesma forma.

Direitos concedidos depois não acrescentam conteúdo a um snapshot antigo. Para isso, o dono atualiza o link.

## Backups

- Biblioteca sem músicas do catálogo: o backup continua com `schemaVersion: 1`, idêntico ao formato anterior.
- Com músicas do catálogo: `schemaVersion: 2`, e cada item traz `source`. O arquivo guarda só a referência, nunca a cifra do catálogo.
- A importação aceita as versões 1 e 2. Antes de gravar, confere que todas as referências do catálogo estão publicadas. Se alguma não estiver, nada é importado.
- Os limites de importação não mudaram.

## Contratos HTTP

Públicos, sem sessão (`Cache-Control: no-store`, 120 requisições por minuto por cliente):

| Rota | Método | Resposta |
| --- | --- | --- |
| `/api/v1/catalog/songs` | GET | `{ songs, page, pageSize, total, totalPages }`. 400 para parâmetros inválidos. |
| `/api/v1/catalog/songs/[id]` | GET | `{ song }`, com a cifra só se `displayChordPro`. 404 se não estiver publicada. |

Administração (sessão, origem e papel; JSON; `If-Match: "n"` nas alterações):

| Rota | Métodos |
| --- | --- |
| `/api/v1/admin/catalog/songs` | GET (`?status=`), POST |
| `/api/v1/admin/catalog/songs/[id]` | GET, PUT |
| `/api/v1/admin/catalog/songs/[id]/publish` | POST |
| `/api/v1/admin/catalog/songs/[id]/unpublish` | POST |
| `/api/v1/admin/catalog/songs/[id]/classification` | PUT (Etapa 2E.2) |
| `/api/v1/admin/catalog/songs/[id]/classification/review` | POST: conferir, registrar ou resolver divergência (Etapa 2E.4) |
| `/api/v1/admin/catalog/quality` | GET: situação de cada música (Etapa 2E.4: `readiness`, `hasChordPro`) |
| `/api/v1/admin/catalog/import/preview` | POST: prévia da importação, sem gravar (Etapa 2E.4) |
| `/api/v1/admin/catalog/import` | POST com `confirm: true`: cria rascunhos (Etapa 2E.4) |

Biblioteca (alterações desta etapa):

- `POST /api/v1/library/repertoires/[id]/items` aceita `{ songId, source? }`, com `source` padrão `personal`.
- `GET /api/v1/library/repertoires` inclui `catalogSongs`.
- `GET /api/v1/library/export` gera a versão 1 ou 2, como descrito acima.

Erros novos: `catalog-song-not-found` (404), `catalog-song-unavailable` (409), `catalog-admin-required` (403) e `rate-limited` (429).

## Índices

| Coleção | Índice | Finalidade |
| --- | --- | --- |
| `catalog_songs` | `id` (único) | Identidade |
| `catalog_songs` | `status + sortTitle + id` | Listagem pública ordenada e paginada |
| `catalog_songs` | `status + searchTokens` | Busca por prefixo de palavra (multikey) |
| `catalog_admins` | `userId` (único) | Papel administrativo |

## Seed de desenvolvimento

Cinco músicas fictícias, escritas para o projeto, que cobrem os casos de direitos. Desde a Etapa 2E.2, o mesmo comando insere também dez cantos fictícios com classificação litúrgica (IDs `liturgia-*`), descritos em [arquitetura-liturgica.md](arquitetura-liturgica.md#dados-de-exemplo):

| ID | Situação |
| --- | --- |
| `catalogo-coracao-de-estrada` | Publicada, exibe e redistribui a cifra |
| `catalogo-manha-de-serra` | Publicada, só exibe |
| `catalogo-ponte-de-papel` | Publicada, somente metadados |
| `catalogo-mar-de-dentro` | Publicada, link externo (`example.com`) |
| `catalogo-rascunho-do-ensaio` | Rascunho |

```bash
docker compose exec app pnpm catalog:seed
# ou, sem Docker: pnpm catalog:seed
```

- Só roda por comando explícito, nunca na inicialização.
- Recusa `NODE_ENV=production`.
- É idempotente: insere somente IDs ausentes e nunca altera, apaga ou sobrescreve uma música existente, global ou particular.

## Testes

- **Unitários** (`pnpm test`): domínio do catálogo (direitos, status, projeção pública, parâmetros), normalização da busca, referências por origem, itens antigos, tom independente, backup versões 1 e 2, snapshot misto, telas do catálogo, inclusão a partir do repertório e do leitor, visitante sem sessão, leitura contextual e editor da administração.
- **Integração** (`docker compose exec app pnpm test:integration`, `tests/integration/catalog.test.ts`), com MongoDB real em banco temporário:
  - A: busca e leitura públicas.
  - B: repertórios com catálogo.
  - C: despublicação.
  - D: dados antigos.
  - E: links públicos e revogação de direitos.
  - F: backup.
  - G: administração, incluindo o comando de concessão e revogação.

## Limitações

- A busca não encontra trechos no meio de palavras, não tolera erros de digitação e não ordena por relevância.
- A paginação vai até a página 50. Com 24 por página, são até 1200 resultados por consulta; refine a busca para ver o restante.
- A contagem total é refeita a cada consulta. Para catálogos muito grandes, será preciso trocar por busca textual dedicada.
- O limite de requisições fica em memória, por instância, e usa o primeiro endereço de `X-Forwarded-For`. Isso só é confiável atrás de um proxy que reescreva esse cabeçalho.
- O tom original não muda depois da primeira publicação.
- Não há exclusão física, histórico de versões da música global nem contribuições de usuários. A importação em lote aceita só metadados ([catalogo-editorial.md](catalogo-editorial.md#importação-de-metadados)).
- Não há tela para conceder o papel administrativo, de propósito: o procedimento é pela linha de comando.
- A listagem da administração mostra até 500 músicas por situação.
