# Compartilhamento público de repertórios

Documentação técnica da Etapa 2C.1. O uso está descrito no [README](../README.md#compartilhamento-público).

## Modelo

A coleção `repertoire_shares` é separada de `repertoires`. Não existe campo `public` no repertório.

| Campo            | Função                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| `id`             | 128 bits aleatórios em base64url; compõe o link                        |
| `ownerId`        | Sempre derivado da sessão                                              |
| `repertoireId`   | Repertório de origem                                                   |
| `name`           | Nome publicado, para o proprietário reconhecer o link                  |
| `status`         | `active` ou `revoked`                                                  |
| `tokenVersion`   | Entra na assinatura; aumenta ao revogar                                |
| `revision`       | Controle de concorrência                                               |
| `cloneVersion`   | Reserva transacional para cópias, em disputa com atualização/revogação  |
| `snapshot`       | O que o público vê. Removido ao revogar                                |
| `contentHash`    | SHA-256 do conteúdo publicado                                          |
| `sources`        | Relação item público ↔ música privada. Nunca lida pela rota pública    |
| `authorizations` | Declaração por música: data, versão do texto, `updatedAt` e hash da cifra |

## Snapshot

`buildShareSnapshot` monta a publicação campo a campo, a partir de documentos do proprietário. O navegador envia somente quais músicas confirmou; o tipo e o conteúdo vêm do banco.

O resultado passa por `publicShareSnapshotSchema`, com `strictObject` em todos os níveis, ao gravar e ao ler. Um campo inesperado invalida a publicação. Os IDs dos itens são derivados (`sha256(shareId:itemId)`): estáveis entre atualizações e sem revelar o ID privado.

## Links

```text
/s/<shareId>.<assinatura>
assinatura = HMAC-SHA256(SHARE_LINK_SECRET, "repertorio-share:v1:<shareId>:<tokenVersion>")
```

O token é derivado, então nenhum segredo fica no banco e o proprietário recupera o link quando quiser. A assinatura é conferida em tempo constante, inclusive quando o ID não existe.

**Perder ou substituir a chave invalida todos os links.** Não há rotação gradual de chaves.

Os caminhos públicos são omitidos dos logs de requisição do Next.js (`logging.incomingRequests.ignore`). Um proxy reverso à frente da aplicação precisa da mesma atenção.

## Rotas

Privadas, com sessão, `ownerId` da sessão e `Cache-Control: private, no-store`:

| Método e rota                                                | Função                               |
| ------------------------------------------------------------ | ------------------------------------ |
| `GET /api/v1/library/shares`                                 | Publicações ativas da conta          |
| `GET /api/v1/library/repertoires/[id]/shares`                | Publicações ativas do repertório     |
| `POST /api/v1/library/repertoires/[id]/shares/preview`       | Prévia; não cria nada                |
| `POST /api/v1/library/repertoires/[id]/shares`               | Cria                                 |
| `POST /api/v1/library/repertoires/[id]/shares/[shareId]/preview` | Prévia de atualização            |
| `PUT /api/v1/library/repertoires/[id]/shares/[shareId]`      | Atualiza                             |
| `DELETE /api/v1/library/repertoires/[id]/shares/[shareId]`   | Revoga                               |
| `POST /api/v1/library/shares/clone`                       | Copia uma publicação ativa para a conta da sessão |

Públicas, sem sessão e somente leitura:

| Rota                              | Função                     |
| --------------------------------- | -------------------------- |
| `GET /s/[shareToken]`             | Página do repertório       |
| `GET /s/[shareToken]/musicas/[itemId]` | Leitor                |
| `GET /api/v1/public/shares/[token]` | Mesmo conteúdo, em JSON  |

Respostas públicas usam `Cache-Control: no-store`, `Referrer-Policy: no-referrer` e `X-Robots-Tag: noindex, nofollow`, aplicados em `src/proxy.ts`. A API repete os cabeçalhos. Inválido, revogado e inexistente têm a mesma resposta.

As páginas públicas ficam fora do grupo `(app)`: não carregam navegação, sessão nem biblioteca durante a leitura. A sessão só é consultada quando a pessoa escolhe copiar. As leituras não usam `use cache`, e `connection()` garante avaliação por requisição.

## Copiar para meus repertórios

Na página `/s/<token>`, **Copiar para meus repertórios** permite salvar uma cópia independente. Ler, abrir músicas e imprimir continuam sem login. Sem sessão, a ação leva a `/entrar?retorno=...`; login, cadastro, confirmação de e-mail e Facebook preservam o retorno para a publicação. O destino é validado estritamente como um caminho de compartilhamento do próprio site, sem redirecionamento externo. Ao retornar, a pessoa confirma a cópia pelo botão; nenhuma navegação GET salva dados automaticamente.

A API autenticada recebe apenas `{ token, requestId }` (UUID). O proprietário do destino vem da sessão, com origem e identidade esperada conferidas. O token vai no corpo, sem aparecer no caminho da API privada. O snapshot é relido e a assinatura, o estado ativo e as permissões atuais são conferidos na transação. Cópias disputam o registro da publicação com atualizações e revogações. A mesma tentativa retorna o mesmo repertório, inclusive em chamadas concorrentes ou novas tentativas após falha de rede; a gravação de músicas e repertório é atômica.

- Nome, descrição, ordem, tons e momentos vêm exclusivamente da versão pública. A data só é copiada se foi publicada; IDs/revisões da celebração, anotações e dados da conta original não são copiados.
- Músicas pessoais recebem novos IDs e ficam na conta de destino. Apenas a cifra publicada é copiada, como conteúdo autorizado; uma cifra omitida permanece omitida. Links externos continuam como links.
- Músicas do catálogo mantêm referências ao catálogo, inclusive músicas só com metadados e sem tom. Não viram cópias particulares de cifras globais. Itens indisponíveis são omitidos com aviso; se nenhum estiver disponível, nada é salvo.
- O resultado informa a quantidade omitida e oferece **Abrir meu repertório**. A cópia pode ser editada sem alterar a origem. Atualizar ou revogar o link não altera cópias já salvas.
- O limite de cópias é de 10 solicitações por minuto, por conta/IP/instância, usando o limitador existente; os limites de itens e tamanho do compartilhamento também se aplicam. Não substitui um limite distribuído no proxy.

Na Vercel, o ambiente usado pelo link deve ter `PUBLIC_SHARING_ENABLED=true` e `SHARE_LINK_SECRET` estável, com pelo menos 32 caracteres. A leitura sem login não depende do Facebook nem do Resend. Uma configuração alterada só entra no novo deployment; preservar a chave existente evita invalidar links anteriores. Não são necessárias variáveis novas para copiar.

## Concorrência

| Situação                         | Mecanismo                                                                 |
| -------------------------------- | ------------------------------------------------------------------------- |
| Prévia × confirmação             | A confirmação refaz o snapshot na transação e compara `expectedHash`      |
| Duas atualizações                | `revision` no filtro da gravação; a outra recebe conflito                 |
| Atualização × revogação          | `status` e `revision` conferidos na gravação; revogado nunca volta        |
| Criação ou atualização × exclusão | A publicação grava em `shareVersion` do repertório: conflito de escrita  |
| Limites em criações simultâneas  | Escrita em `library_states` serializa por proprietário                    |

A exclusão de repertório remove o documento e revoga as publicações na mesma transação.

## Limites

| Variável                         | Padrão | Significado                       |
| -------------------------------- | ------ | --------------------------------- |
| `SHARE_MAX_LINKS_PER_REPERTOIRE` | 10     | Links ativos por repertório       |
| `SHARE_MAX_LINKS_PER_USER`       | 50     | Links ativos por conta            |
| `SHARE_MAX_ITEMS`                | 200    | Músicas por publicação            |
| `SHARE_MAX_SNAPSHOT_BYTES`       | 4 MB   | Tamanho do snapshot; máximo 12 MB |
| `SHARE_MAX_WRITES_PER_HOUR`      | 60     | Criações e atualizações por conta |

O contador de frequência fica na coleção `share_rate_limits`, com expiração automática, e vale entre instâncias.

## Rascunhos e sessão expirada

Um formulário alterado se registra em `activeLibrary.trackDraft`. Se a sessão cair, `LibraryGate` mantém a tela e mostra um aviso com senha para a mesma conta, sem navegar.

- O texto fica somente na memória da aba. Não há autosave nem cópia em `localStorage`.
- O envio continua vinculado à conta original: se o cookie for de outra, o servidor responde `session_changed`.
- Se outra conta assumir o navegador, o rascunho é descartado para não ficar à vista dela.

## Pendências para produção

- Revisão jurídica sobre direitos autorais e canal de denúncia e remoção. A declaração do proprietário não é licença.
- Rate limiting da leitura pública, por IP, em um proxy ou CDN. Hoje só as escritas são limitadas.
- Rotação de `SHARE_LINK_SECRET` sem invalidar links.
- Configuração de logs do proxy reverso para omitir `/s/` e `/api/v1/public/`.
- Content-Security-Policy nas páginas públicas.
- As páginas públicas respondem HTTP 200 mesmo com link indisponível, pois o conteúdo é transmitido em streaming. A API pública responde 404.
