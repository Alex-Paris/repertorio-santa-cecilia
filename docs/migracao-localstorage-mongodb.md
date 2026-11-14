# Migração da biblioteca: localStorage para MongoDB

Situação após a Etapa 2C.2: **o MongoDB é a única fonte editável.** O `localStorage` deixou de ser uma biblioteca ativa. Dados de instalações antigas são preservados e podem ser importados por uma ferramenta dedicada.

**A importação é uma cópia única, feita somente com confirmação.**

## Dados antigos

- A chave `repertorio.biblioteca.v1` é **somente lida**, por `features/library/legacy/legacy-library.ts`.
- Nenhum fluxo automático a remove ou altera: login, logout, cadastro, troca de conta, atualização e importação a mantêm igual.
- A única remoção é explícita: "Apagar biblioteca antiga deste navegador", na ferramenta, com quantidades, aviso de irreversibilidade, opção de backup e confirmação. Apaga somente `repertorio.biblioteca.v1` (sem `localStorage.clear()` nem `Clear-Site-Data`), funciona com dados danificados, mostra erro se a chave continuar presente e acompanha mudanças de outra aba pelo evento `storage`.
- Com o armazenamento vazio, nada é criado. Exemplos não são mais gerados.
- Os dados pertencem ao navegador, não a uma conta confiável. Por isso a importação exige revisão e confirmação.
- Bibliotecas que só têm os exemplos criados por versões antigas não geram aviso na tela inicial, mas continuam disponíveis na ferramenta.

## Ferramenta de importação

Disponível em `/conta/importar-biblioteca-antiga`, com sessão. Mostra as quantidades, oferece o backup JSON e aceita também um arquivo de backup como origem. Dados danificados não são importados: a tela oferece baixar o conteúdo original, sem alterá-lo.

## Contrato da importação (Etapa 2B.1)

Todas as rotas exigem sessão válida, origem confiável e `Content-Type: application/json`. O proprietário vem sempre da sessão.

### `POST /api/v1/library/import/preview`

Corpo: `{ "backup": { ... }, "importId"?: "<uuid>" }`. Valida e não grava nada.

```json
{
  "preview": {
    "summary": { "songs": 6, "repertoires": 2, "items": 7, "schemaVersion": 1, "exportedAt": "..." },
    "remote": { "songs": 0, "repertoires": 0, "isEmpty": true },
    "canImport": true,
    "conflicts": []
  }
}
```

`conflicts` pode conter `remote_library_not_empty`, `import_id_conflict` e `already_imported`. O preview não substitui a validação da execução.

### `POST /api/v1/library/import`

Corpo: `{ "importId": "<uuid>", "backup": { ... } }`. O envelope do backup é o mesmo da exportação: `schemaVersion`, `songs`, `repertoires` e, opcionalmente, `exportedAt`.

```json
{
  "import": {
    "importId": "...", "status": "completed", "replayed": false,
    "songs": 6, "repertoires": 2, "items": 7, "schemaVersion": 1, "completedAt": "..."
  }
}
```

| Status | Situação                                                                    |
| ------ | --------------------------------------------------------------------------- |
| 201    | Importado                                                                   |
| 200    | Repetição do mesmo `importId` e conteúdo; devolve o resultado anterior      |
| 400    | Backup ou requisição inválidos (`invalid_input`)                            |
| 401    | Sem sessão                                                                  |
| 403    | Origem não confiável                                                        |
| 409    | `remote_library_not_empty`, `import_id_conflict` ou `conflict`              |
| 413    | Excede os limites                                                           |
| 415    | Conteúdo que não é JSON                                                     |
| 503    | Banco indisponível. O resultado é incerto: consulte o status antes de agir  |

### `GET /api/v1/library/imports/[importId]`

Devolve `{ "import": { "status": "completed", ...resumo } }` ou `{ "import": { "status": "unknown", "importId", "message" } }`. O estado `unknown` **não indica sucesso nem falha**. Importações de outro usuário respondem igual a uma inexistente.

### Limites

| Limite                 | Valor             |
| ---------------------- | ----------------- |
| Corpo da requisição    | 5 MB + 16 KB      |
| Músicas                | 5.000             |
| Repertórios            | 1.000             |
| Itens no total         | 20.000            |

O corpo é lido em partes e a leitura é interrompida ao exceder o limite, sem confiar no `Content-Length`. Campos individuais seguem os mesmos limites do domínio.

### Validação

Usa o mesmo caminho do navegador e dos dados salvos: envelope versionado, esquemas estritos e integridade referencial. Propriedades desconhecidas, como `ownerId`, `_id` ou credenciais, invalidam o backup. A importação acrescenta duas regras: posições repetidas em um repertório são rejeitadas, e nenhum valor é corrigido em silêncio. Um título com espaços nas pontas, por exemplo, rejeita o arquivo.

## Garantias da importação

**Transação.** Tudo acontece em uma transação MongoDB real (`readConcern: snapshot`, `writeConcern: majority` com journal, leitura no primário): verificação do `importId`, reserva do estado, verificação de biblioteca vazia, inserção das músicas, dos repertórios e do registro. As operações rodam em sequência na mesma sessão. Novas tentativas de conflitos transitórios e commits incertos ficam a cargo de `withTransaction`, do driver oficial.

**Concorrência por proprietário.** Cada usuário tem um documento em `library_states`. A importação e toda criação de música ou repertório escrevem nele dentro da transação. Duas operações concorrentes do mesmo usuário geram um conflito de escrita, e o MongoDB refaz a perdedora, que passa a enxergar o estado confirmado pela vencedora. Assim, a verificação de biblioteca vazia não depende de uma leitura isolada.

Resultados possíveis entre importação e criação simultâneas: a importação conclui e a criação entra depois, ou a criação conclui e a importação recebe 409. Nunca há importação parcial. Alterações e exclusões de documentos existentes não disputam esse estado, porque só existem em uma biblioteca que já não está vazia.

Limites: a garantia exige replica set e vale para escritas feitas pelos repositórios da aplicação. Uma escrita manual direta no banco não participa desse controle.

**Idempotência.** O `importId` é gerado pelo cliente a cada tentativa lógica e reutilizado em repetições. O registro em `library_imports` fica na mesma transação dos dados e guarda somente contagens e um hash SHA-256 do conteúdo, nunca o backup. O hash não depende da ordem das chaves nem de `exportedAt`. Um índice único em `ownerId + importId` protege contra duplicidade.

**Resultado incerto.** Se a conexão cair depois do commit, o cliente não deve gerar um novo `importId`. Deve consultar o status ou repetir com o mesmo `importId` e o mesmo conteúdo, o que é sempre seguro.

## Contrato uniforme dos repositórios

As implementações local e MongoDB cumprem as mesmas regras, verificadas por uma única suíte (`src/test/repository-contract.ts`). Em especial, remover, mover ou alterar um item inexistente gera `repertoire-item-not-found`, e um repertório inexistente gera `repertoire-not-found`.

## Testes

```bash
pnpm test                                       # unidade, sem banco
docker compose exec app pnpm test:integration   # MongoDB real, em banco temporário
```

## Fluxo da importação

O início é sempre explícito.

1. Lê a origem e valida com as regras do backup.
2. Confere os limites no navegador; o servidor sempre valida de novo.
3. Pede a prévia (`/import/preview`), que não altera nada.
4. Oferece o download do backup e pede confirmação.
5. Gera o `importId` com `crypto.randomUUID()` e o grava **antes** do primeiro envio. Se não puder gravar, a importação não começa.
6. Envia o backup e, com a resposta, confere o que está na conta.
7. Oferece abrir a biblioteca.

### Registro da tentativa

A chave `repertorio.migration.v1.<userId>` guarda apenas `userId`, `importId`, um identificador não criptográfico do conteúdo, a situação e a data. Não há cópia da biblioteca, senha nem token. Cada conta tem sua própria chave.

### Conflitos

Vale a política da Etapa 2B.1: a importação só é aceita para uma conta vazia. Com dados na conta, a tela explica que a importação para conta preenchida ainda não é suportada, preserva as duas bibliotecas e mantém o backup disponível. Um `409` é respeitado mesmo depois de uma prévia sem conflitos.

### Resultado incerto

| Situação                         | O que acontece                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Rede caiu, tempo esgotado ou 503 | Mantém o `importId` e consulta `/imports/[importId]`. Um 503 não prova rollback. |
| Status `completed`               | Conclusão, sem novo envio.                                                      |
| Status `unknown` ou sem consulta | Informa a incerteza. Não há repetição automática.                               |
| Repetir                          | Só com o mesmo `importId` e o mesmo conteúdo local.                             |
| Dados locais mudaram             | O `importId` não é reutilizado. A tentativa só pode ser descartada, com confirmação. |
| Página recarregada               | A tentativa pendente é recuperada e consultada.                                 |
| Concluída, mas leitura falhou    | Informa que a cópia terminou e orienta a não copiar de novo.                    |

Descartar uma tentativa só é oferecido depois que o servidor respondeu `unknown`. Mesmo assim, uma nova cópia só é aceita se a conta continuar vazia, o que impede a duplicação.

### Depois da importação

A biblioteca lê e grava apenas pela API. Os dados antigos continuam intactos no navegador, sem efeito sobre o aplicativo.

## Pendências para produção

- Rate limiting com armazenamento compartilhado e revisão do cadastro público.
- Domínio com HTTPS e `BETTER_AUTH_URL` correspondente.
- Política para um segundo aparelho que queira enviar dados para uma conta já preenchida: hoje isso é recusado.

## Testes alterados na Etapa 2C.2

| Grupo | O que mudou |
| --- | --- |
| `song-flows`, `repertoire-flows`, `presentation-flows`, `transposition-flows`, página da música | Mesmos cenários, agora pelos adaptadores HTTP e por uma API falsa com o formato de erro real |
| Repositórios locais | Movidos para `src/test/fakes`, servindo à API falsa. Regras de domínio mantidas; saíram os dois testes de falha de gravação no `localStorage` |
| `library-store` | Removido com o store. Leitura legada coberta por `legacy-library.test` |
| `library-storage` | Mantida a leitura e a validação; saíram os testes de gravação |
| `active-library` | Substituído por `account-library`, sem seleção de fonte |
| `library-switcher` | Substituído por `library-gate`, com os estados sem sessão e indisponível |
| `backup-import-flow`, recuperação em `library-screens` | A substituição local foi removida. Arquivo de backup e dados danificados estão em `migration-screen` |
| `library-screens`, `session-draft`, `share-repertoire-screen`, `migration-screen`, `auth-forms` | Adaptados à conta única e à nova rota após o login |
