# Concorrência e revisões (Etapa 2D.1)

## Modelo

`Song` e `Repertoire`, como a API privada os entrega, têm `revision`: um inteiro que começa em 1 e só o servidor aumenta, uma vez por alteração confirmada. Nunca diminui. `createdAt` não muda; `updatedAt` muda a cada alteração.

`SongRecord`, `RepertoireRecord` e `LibraryRecord` são o mesmo conteúdo sem revisão: o formato do backup e da biblioteca antiga do navegador.

Documentos gravados antes desta etapa não têm o campo no MongoDB e valem como revisão 1. Não há migração em lote: a primeira alteração grava a revisão 2.

A revisão das publicações públicas (`repertoire_shares.revision`) é outro mecanismo, sem relação com esta.

## Escrita atômica

A revisão esperada faz parte do **filtro da própria operação** de escrita, e a nova revisão é gravada na mesma operação:

```js
findOneAndUpdate(
  { ownerId, id, revision: esperada },
  { $set: { ...campos, revision: esperada + 1, updatedAt } },
)
```

Para a revisão 1, o filtro aceita também documentos sem o campo. Sem documento correspondente, uma consulta só para escolher a resposta diferencia "não existe" (404) de "revisão antiga" (412). O `optimisticConcurrency` do Mongoose não é usado: ele não protege `updateOne` nem `findOneAndUpdate`.

| Operação | Como a revisão é verificada |
| --- | --- |
| Editar música ou repertório | `findOneAndUpdate` com a revisão no filtro |
| Excluir música | `deleteOne` com a revisão no filtro, na transação que confere o uso em repertórios |
| Excluir repertório | `deleteOne` com a revisão no filtro, na transação que revoga as publicações |
| Incluir, remover, mover item; tom; anotações | Transação: confere na leitura e grava com `updateOne` filtrado pela revisão |

A importação continua uma operação própria e transacional, que cria os documentos na revisão 1.

## Contrato HTTP

A revisão esperada vai em **`If-Match`**, como ETag forte: `If-Match: "3"`. Vale para `PUT` e `DELETE` de músicas e repertórios e para todas as rotas de itens.

| Situação | Resposta |
| --- | --- |
| Revisão correta | 200 (ou 201/204), com `ETag: "<nova revisão>"` e o documento com `revision` |
| Revisão antiga | **412** `precondition_failed` |
| `If-Match` ausente, `*`, fraco (`W/`) ou inválido | **428** `precondition_required` |
| Documento inexistente ou de outra conta | 404 |
| Sem sessão | 401 |

Leituras e criações também devolvem `ETag`. As respostas privadas continuam com `Cache-Control: private, no-store`. O cliente nunca define a nova revisão nem envia `ownerId`.

## Cliente

- Formulários guardam a revisão que carregaram. Recarregar a tela não muda essa base: só uma decisão da pessoa (descartar o rascunho) troca o conteúdo e a revisão.
- Gravações do mesmo documento, na mesma aba, entram em fila: nunca há duas com a mesma revisão.
- Alterações de itens feitas logo depois de outra, na mesma aba, seguem sobre a revisão que essa aba acabou de produzir. Alterações de outro dispositivo nunca entram nessa cadeia e continuam gerando conflito. Formulários inteiros não usam esse encadeamento.
- Depois de um conflito, a biblioteca é relida em segundo plano; a resposta recusada nunca aparece como alteração concluída.

## Limitações

- O controle é por documento: duas alterações em itens diferentes do mesmo repertório, ao mesmo tempo, em dois aparelhos, também conflitam.
- Não há mesclagem automática, comparação lado a lado nem histórico de versões.
- Uma gravação sem resposta (falha de rede) pode ter sido concluída. A próxima alteração feita sobre a revisão antiga gera conflito, que se resolve recarregando a versão atual.

## Testes alterados nesta etapa

| Grupo | Motivo |
| --- | --- |
| Contrato dos repositórios, repositórios em memória e integração (repositórios, isolamento, publicações, biblioteca remota, consolidação) | Escritas passam pela revisão atual (`src/test/latest-revision.ts`), já que o contrato exige revisão; o controle de versão ganhou testes próprios |
| `concurrency.test` (escritas simultâneas no mesmo repertório) | Antes, escritas paralelas se combinavam; agora uma vence e as outras são recusadas. Os testes garantem que nada se perde em silêncio |
| `api.test` | Envio de `If-Match` e `revision` no formato do domínio |
| `library-import.test` (integração) | Documentos importados trazem `revision: 1` |
| Fixtures de interface | Documentos da conta têm revisão; os exemplos antigos continuam sem |
