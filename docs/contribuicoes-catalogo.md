# Contribuições para o catálogo (Etapa 2F.1)

Quem tem conta pode sugerir ao catálogo central uma música da própria biblioteca. Toda sugestão passa pela revisão de uma pessoa da administração antes de qualquer publicação. A música particular continua privada, editável e intocada: a sugestão guarda uma cópia própria.

## Fluxo

1. Na página de uma música particular (`/musicas/<id>`), **Sugerir para o catálogo** abre `/musicas/<id>/sugerir`.
2. O formulário mostra a prévia do que será enviado (título, autoria, tom, tipo de conteúdo e, recolhida, a letra com a cifra), as músicas semelhantes já publicadas, a situação dos direitos, o vídeo e a classificação (opcionais, recolhidos), o crédito público e a declaração.
3. O envio grava uma proposta `pending` em `catalog_submissions`. Nada aparece no catálogo.
4. A pessoa acompanha em **Minha conta → Minhas sugestões** (`/conta/sugestoes`) e no detalhe (`/conta/sugestoes/<id>`), com a linha do tempo, a justificativa da equipe e a música oficial resultante.
5. A administração revisa em `/admin/contribuicoes` e decide: aprovar como música nova, aprovar como complemento de uma existente, pedir correções ou recusar.
6. Com correções pedidas, a pessoa edita a própria música e envia uma **nova versão**; a versão anterior fica guardada em `previousVersions`. Uma sugestão em andamento pode ser **retirada** a qualquer momento.

Não há cadastro paralelo: o conteúdo vem sempre da biblioteca da conta, relido no servidor. O navegador nunca envia letra, cifra, dono nem situação.

## Música particular e música oficial

| | Música particular (`songs`) | Proposta (`catalog_submissions`) | Música oficial (`catalog_songs`) |
| --- | --- | --- | --- |
| Dono | A conta (`ownerId`) | Conta que enviou (`submittedBy`) | Nenhum: global |
| Conteúdo | Editável a qualquer momento | Cópia da versão enviada (`snapshot`) | Criada ou complementada pela administração |
| Visível para | Só a conta | A conta e a administração | Todos, se publicada |

- Aprovar **cria** uma `CatalogSong` própria (ou atualiza uma existente). Nunca troca o `ownerId` de uma música, nunca apaga a particular, nunca troca itens `personal` por `catalog` nos repertórios e não sincroniza as duas versões depois.
- O `snapshot` copia só campos editoriais: título, autoria, tom, tipo de conteúdo e a cifra (ou o link externo). Nada da conta, de repertórios ou de anotações.
- Editar a música particular depois do envio não muda a proposta (testado).

## Situações

| Situação | Rótulo | Ações possíveis |
| --- | --- | --- |
| `pending` | Em análise | aprovar, recusar, pedir correções (administração); retirar (autor) |
| `needs_changes` | Precisa de correções | reenviar, retirar (autor); recusar (administração) |
| `approved` | Aprovada | — (final) |
| `rejected` | Recusada | — (final) |
| `withdrawn` | Retirada | — (final) |

As transições estão em `nextSubmissionStatus` (`src/features/contributions/domain/submission.ts`). Uma proposta aprovada nunca volta à fila nem gera outra publicação. Cada decisão entra em `history` (ação, quem, quando, versão, nota); o autor vê o histórico sem a identificação de quem decidiu ("equipe do catálogo"). Recusar e pedir correções exigem justificativa. **Quem enviou não decide sobre a própria proposta**, mesmo sendo da administração.

## Revisão administrativa

`/admin/contribuicoes` usa o mesmo papel `catalog_admins` da administração do catálogo, conferido no banco a cada requisição (sem autoelevação). A fila filtra por situação (em análise primeiro, em ordem de chegada). A tela de revisão mostra:

- remetente (nome e e-mail lidos da coleção de contas **no momento da consulta**, nunca copiados na proposta), datas e mensagem;
- letra e cifra enviadas, direitos declarados com a versão da declaração, possíveis duplicatas (inclusive rascunhos e despublicadas), classificação e vídeo sugeridos, histórico e versões anteriores;
- os painéis de decisão.

Ajustes editoriais na aprovação (título, autoria, tom, referência da composição, nome público) valem só para o catálogo; a biblioteca do autor não muda.

## Duplicatas

- **Normalização:** caixa, acentos, pontuação e espaços repetidos (`comparableTitle`, sobre o mesmo `tokenize` da busca).
- **Título + autoria:** mesmo título e autoria compatível (igual, ou ausente de um dos lados) é "mesma música provável" (`same-song`); mesmo título com outra autoria é só "mesmo título" (`same-title`) e não bloqueia nada.
- **Busca:** as palavras do título filtram pelo índice `searchTokens`; a comparação final é exata.
- **Para o autor:** só músicas **publicadas** (rascunhos da administração não vazam). Havendo `same-song`, o formulário mostra "Encontramos músicas semelhantes no catálogo." com "Ver no catálogo" e duas escolhas: "É a mesma música: quero sugerir correção, classificação ou vídeo para ela" ou "É outra música: vou explicar a diferença". Sem justificativa, o servidor recusa (`submission-duplicates`, 409).
- **Na aprovação como nova:** as duplicatas são conferidas de novo **dentro da transação**, contra todo o catálogo. A tela envia as duplicatas que a pessoa viu (`knownDuplicateIds`); uma nova, surgida depois da análise, interrompe a aprovação.
- **Nada é mesclado automaticamente.** Títulos alternativos ainda não existem no modelo (limitação).

## Aprovação: nova ou complemento

Tudo numa transação do MongoDB (`runTransaction`): conferir a situação e a revisão esperada da proposta, conferir que nenhuma música já registra esta proposta, criar ou atualizar a `CatalogSong`, gravar a decisão, o resultado, a nova revisão e quem decidiu.

**Nova** (`mode: "new"`):

- **A — registro:** título, autoria, tom, referência, classificação sugerida (opcional) e vídeo (opcional). Sem autorização de conteúdo, entra como `metadata-only`, fundamento `public-metadata`.
- **B — publicação da letra e da cifra (`publishContent`):** só se a proposta tem cifra, o autor declarou "a composição é minha" ou "tenho autorização" **e** autorizou exibir e reproduzir. Tipo `original` ou `authorized`, fundamento `author-permission`, `displayChordPro: true`. A redistribuição em links públicos (`shareChordPro`) só com a autorização específica e a marcação da administração.
- `publish: false` deixa a música como rascunho em `/admin/catalogo` para mais edição.
- A evidência dos direitos é gerada com o identificador e a versão da proposta, a declaração aceita (texto e data) e as autorizações.

**Complemento** (`mode: "complement"`): a administração escolhe a música de destino (entre as duplicatas ou pelo identificador) e envia a **revisão do destino**; outra alteração no meio dá 412. Aplica só:

- classificação sugerida, se o destino não tem classificação ou ela ainda não foi conferida (mesclada, continua "não conferida"); classificação conferida ou com divergência **nunca** é substituída;
- vídeo, se o destino não tem vídeo;
- tom original, se o destino não tem tom.

Título, autoria, cifra e direitos oficiais nunca são trocados por uma sugestão. Uma cifra alternativa proposta fica visível na revisão e, se aceita, é editada à mão em `/admin/catalogo/<id>`.

A `CatalogSong` registra cada contribuição aceita em `contributions[]` (proposta, versão, modo, campos aplicados, quem e quando aprovou, crédito público e licença declarada). Um índice único parcial impede que duas propostas aprovadas como novas apontem para a mesma música.

## Conteúdo e direitos

- O autor escolhe uma situação: composição própria; autorização de quem compôs; domínio público; obra de outra pessoa sem autorização; não sei.
- Só as duas primeiras permitem conceder autorização **não exclusiva**, separada em exibir, reproduzir (leitura, transposição, apresentação) e redistribuir em repertórios públicos. Redistribuir exige exibir; exibir exige reproduzir.
- A declaração aceita fica registrada com a versão do texto (`RIGHTS_DECLARATION_VERSION = "2026-11-contribuicao-v1"`) e a data. **É declaração, não prova:** a administração confere e, na dúvida, aprova só os metadados.
- O formulário lembra que não se deve copiar letra ou cifra de sites ou publicações sem autorização. Link externo de uma música particular não é publicado a partir de sugestões.
- **Retirada e contestação:** a administração remove o vídeo e/ou o crédito de uma música (`POST /api/v1/admin/catalog/songs/<id>/contribution-removal`, com `If-Match`) pela tela da proposta aprovada; letra e cifra saem despublicando ou editando a música em `/admin/catalogo`. Os termos ainda **dependem de revisão jurídica** antes da abertura pública.

## Crédito público

- Opcional e desligado por padrão. Quem quer crédito escolhe um **nome público** próprio (2 a 60 caracteres, sem e-mail nem endereço de site). O nome da conta nunca é usado automaticamente.
- A administração pode ajustar o nome ou não exibir; sem autorização do autor, o servidor recusa qualquer crédito.
- No leitor do catálogo aparece discreto, sob a autoria: "Enviado por: Nome". Não se confunde com composição, intérprete nem quem aprovou. Só a contribuição que **criou** a música dá crédito; complementos não.
- A projeção pública nunca traz e-mail, identificador de conta, quem aprovou ou o identificador da proposta (testado).

## Vídeo do YouTube

- Um vídeo por proposta. Aceita links `https` de `youtube.com/watch`, `youtu.be`, `/embed/`, `/shorts/` e `/live/`; HTML, `iframe`, outros sites e `http` são recusados.
- Guarda-se só o estruturado: `{ provider: "youtube", videoId, title?, kind, ownPerformance }`. O link digitado não é guardado.
- "Este vídeo é uma apresentação minha." é declaração; a administração marca que assistiu e que o vídeo corresponde à música (`videoVerified`) antes de publicá-lo.
- No catálogo, `video: { provider, videoId, title? }`. O componente `VideoReference` mostra "Sem vídeo de referência" quando não há; com vídeo, "Referência em vídeo" abre um painel flutuante não modal (Esc e botão de fechar, foco de volta), sem iframe até "Carregar vídeo", no modo `youtube-nocookie.com`, sem reprodução automática, com "Abrir no YouTube" e o aviso de que um vídeo removido aparece como indisponível no próprio player. Sem áudio próprio nem download.

## Segurança e privacidade

- Rotas da conta com sessão validada no servidor, origem confiável, cabeçalho `x-repertorio-expected-user` (troca de conta em outra aba é recusada), `private, no-store`.
- `submittedBy` sempre da sessão; esquemas Zod estritos recusam `ownerId`, `submittedBy`, `status`, `chordPro` e qualquer campo extra.
- Proposta de outra conta responde 404, igual a inexistente. A prévia e o envio só aceitam músicas da própria biblioteca.
- Rotas da administração conferem o papel no banco a cada requisição; usuário comum recebe 403.
- Propostas não aparecem em nenhuma rota pública; a busca e o leitor públicos só leem `catalog_songs` publicadas.

## Limites

| Limite | Padrão | Variável |
| --- | --- | --- |
| Propostas em andamento (análise ou correções) por conta | 5 | `CONTRIBUTION_MAX_PENDING` |
| Propostas novas em 24 horas por conta | 10 | `CONTRIBUTION_MAX_PER_DAY` |
| Tamanho da cifra enviada | 50.000 caracteres | `CONTRIBUTION_MAX_CHORDPRO_LENGTH` |
| Vídeos por proposta | 1 | — |
| Mensagem, justificativas e observações | 1.000 caracteres | — |
| Nome público | 60 caracteres | — |

Os limites são conferidos no servidor e contados no MongoDB, não em memória. Cada envio altera, dentro da transação, o documento da conta em `catalog_submission_quotas`: envios simultâneos (várias abas ou instâncias) disputam esse documento, e o perdedor recomeça e conta de novo. Uma única proposta em andamento por música particular. Não há CAPTCHA nem uso de `X-Forwarded-For`.

## Concorrência e repetição

- Toda alteração de uma proposta existente exige `If-Match` com a revisão (`428` sem ela, `412` se mudou). A revisão e a situação entram no filtro da própria escrita: duas decisões nunca valem juntas, mesmo de duas pessoas ao mesmo tempo (testado com duas contas da administração).
- **Envio:** o navegador gera um `requestId` (UUID) por formulário. Repetir o mesmo pedido (clique duplo, resposta perdida) devolve a mesma proposta (índice único `submittedBy + requestId`).
- **Reenvio:** o `requestId` entra no histórico; repeti-lo devolve a versão já gravada, sem criar outra.
- **Aprovação:** o `requestId` fica em `review.requestId`; repetir o mesmo pedido devolve a mesma música, sem criar outra. Sem resposta do servidor, a tela diz "Não foi possível confirmar… o mesmo pedido não cria uma segunda música", sem afirmar falha definitiva.
- Os botões são desabilitados durante o envio, mas a garantia está no servidor.
- Os subesquemas Mongoose dessas coleções usam `versionKey: false`: ao repetir uma transação, o Mongoose restaura a chave de versão dos documentos criados, e o modo estrito recusaria `__v`.

## Exclusões

- **Música particular excluída:** a proposta continua com a própria cópia. Com sugestão em andamento, o diálogo de exclusão avisa e sugere retirá-la em Minhas sugestões. Um reenvio depois da exclusão é recusado com explicação.
- **Retirar:** a proposta sai da fila e guarda só o mínimo para auditoria: título, autoria, tom, declarações e histórico; a cifra enviada (atual e anteriores) é descartada.
- **Música oficial:** nunca é apagada por ações do autor. Retirada de conteúdo é decisão da administração (despublicar, editar, remover vídeo ou crédito).
- Registros da administração não são apagados: ainda não há política de retenção.

## Endpoints

Conta da sessão (`authenticatedRoute`):

| Rota | Método | Uso |
| --- | --- | --- |
| `/api/v1/catalog/submissions` | POST | Enviar (`201`; `200` se o mesmo `requestId` já existia) |
| `/api/v1/catalog/submissions/preview?songId=` | GET | Prévia: cópia, duplicatas publicadas, proposta ativa e limites |
| `/api/v1/catalog/submissions/mine` | GET | Minhas sugestões (sem a cifra) |
| `/api/v1/catalog/submissions/[id]` | GET | Detalhe da própria proposta (`ETag`) |
| `/api/v1/catalog/submissions/[id]/withdraw` | POST | Retirar (`If-Match`) |
| `/api/v1/catalog/submissions/[id]/resubmit` | POST | Nova versão após correções (`If-Match`) |

Administração (`adminRoute`):

| Rota | Método | Uso |
| --- | --- | --- |
| `/api/v1/admin/catalog/submissions?status=` | GET | Fila |
| `/api/v1/admin/catalog/submissions/[id]` | GET | Proposta com remetente e duplicatas atuais |
| `/api/v1/admin/catalog/submissions/[id]/approve` | POST | Nova ou complemento (`If-Match`) |
| `/api/v1/admin/catalog/submissions/[id]/reject` | POST | Recusar com justificativa (`If-Match`) |
| `/api/v1/admin/catalog/submissions/[id]/request-changes` | POST | Pedir correções (`If-Match`) |
| `/api/v1/admin/catalog/songs/[id]/contribution-removal` | POST | Remover vídeo e/ou crédito (`If-Match`) |

Erros novos: `submission-not-found` (404), `submission-active` (409), `submission-limit-exceeded` e `submission-daily-limit` (429), `submission-already-reviewed` (409), `submission-duplicates` (409), `submission-content-too-large` (413). Todas as respostas são `private, no-store`.

## Coleções e índices

`catalog_submissions`: `{ id }` único; `{ submittedBy, requestId }` único; `{ submittedBy, status, submittedAt }`; `{ submittedBy, personalSongId, status }`; `{ status, submittedAt, id }`; `{ resultingCatalogSongId, review.mode }` único parcial (só aprovadas como nova).

`catalog_submission_quotas`: `{ userId }` único.

`catalog_songs` ganhou `video` e `contributions` (opcionais; músicas anteriores continuam válidas). A atualização pela administração do catálogo não mexe nesses campos.

## Repertórios e compartilhamentos

Enviar, aprovar, recusar ou retirar não altera repertórios (itens, origem, tom, anotações, ordem), não publica a música particular, não altera retratos de links públicos nem cria compartilhamentos (testado). A música oficial pode ser adicionada a um repertório como item do catálogo e segue as permissões de exibição e redistribuição dela.

## Limitações conhecidas

- Duplicatas só por título normalizado e autoria; não há títulos alternativos, semelhança aproximada nem comparação de letra.
- O complemento não aplica cifra alternativa nem corrige título ou autoria: a administração edita à mão.
- A retirada de vídeo ou crédito não guarda um registro próprio (só a nova revisão da música); não há fluxo público de contestação, só o contato com a equipe.
- Não há notificação por e-mail das decisões: a pessoa confere em Minhas sugestões.
- A disponibilidade do vídeo não é conferida no servidor; um vídeo removido aparece como indisponível no próprio player.
- Os termos da declaração precisam de revisão jurídica antes da abertura pública.
- Validado no Chrome (computador e emulação de celular, 360 a 1448 px). Safari e iOS não foram testados.
