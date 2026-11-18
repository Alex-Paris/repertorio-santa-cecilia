# Repertório

> O nome "Repertório" é provisório.

Plataforma de cifras católicas e de planejamento musical da Santa Missa. Músicos escolhem a celebração, veem as leituras do dia, encontram cantos para cada momento da missa e montam o repertório, em computadores, tablets e celulares.

Este repositório está na **Etapa 2E.3**. O MongoDB é a única fonte editável da biblioteca: músicas e repertórios pertencem à conta autenticada, e cada um tem controle de versão contra sobrescritas entre dispositivos. Um **catálogo central**, mantido pela administração, oferece músicas globais que qualquer pessoa consulta e que as contas usam nos seus repertórios. As músicas do catálogo têm **classificação litúrgica**, e a tela **Preparar missa** sugere cantos para cada celebração.

> **Gerenciar a biblioteca exige login.** A página inicial, a preparação da missa, o catálogo, login, cadastro e links públicos de repertórios são abertos.

> **A base de celebrações é editorial e limitada.** Ela fica no MongoDB, cobre poucas datas e não é um calendário litúrgico completo. Cada celebração mostra se já foi revisada por uma pessoa da administração, em revisão, com divergência ou em atualização. As sugestões são do Repertório Web e não representam aprovação oficial da Igreja. Veja [docs/curadoria-liturgica.md](docs/curadoria-liturgica.md) e [docs/arquitetura-liturgica.md](docs/arquitetura-liturgica.md).

> **Não há suporte offline nesta versão.** Sem conexão com o servidor, a biblioteca fica indisponível e nada é salvo. O plano futuro está em [docs/cache-offline-futuro.md](docs/cache-offline-futuro.md).

## Recursos

- Preparação da missa: celebração da data, referências das leituras e sugestões de cantos por momento, com a justificativa de cada uma.
- Repertório da missa montado na mesma tela, com o momento e o tom de cada música.
- Catálogo central de músicas, com busca pública por título ou artista, filtros por momento, tempo litúrgico, celebração e tema, caminhos de exploração pelas classificações existentes e leitura sem login.
- Músicas cadastradas só com metadados (título, autoria, referência e fontes), sem copiar letra nem cifra: aparecem como "Cifra ainda não disponível".
- Biblioteca particular com busca e filtro por tipo de conteúdo.
- Criação, edição e exclusão de músicas.
- Editor de cifras em ChordPro com prévia usando o mesmo leitor da página da música.
- Criação, edição e exclusão de repertórios.
- Inclusão de músicas do catálogo ou particulares, remoção e reordenação em cada repertório.
- Transposição das cifras na leitura, de -11 a +11 semitons.
- Tom e anotações próprios de cada música em cada repertório.
- Biblioteca salva na conta, disponível em qualquer navegador.
- Modo apresentação com rolagem automática, controle de fonte e navegação entre as músicas do repertório, em fundo claro (pergaminho) por padrão.
- Leitura em modo **Cifra** ou **Letra** (só a letra, sem acordes) e impressão pelo navegador, inclusive "Salvar como PDF": música com cifra ou só a letra, repertório só com as letras (contínuo) ou com as cifras (uma música por folha). Veja [docs/leitura-e-impressao.md](docs/leitura-e-impressao.md).
- Exportação de backup em JSON e links públicos de repertórios.
- Recuperação de bibliotecas antigas guardadas no navegador.
- Modo claro e escuro, em layout para celular e computador, com as cores litúrgicas sempre acompanhadas do nome.
- Contribuições ao catálogo: quem tem conta sugere uma música da própria biblioteca (com vídeo do YouTube e crédito público opcionais); a administração revisa em `/admin/contribuicoes` antes de qualquer publicação, e a música particular continua privada. Veja [docs/contribuicoes-catalogo.md](docs/contribuicoes-catalogo.md).
- Identidade visual do Grupo de Canto Santa Cecília: catálogo em três zonas (lista, música e repertório atual) e preparação da missa com sugestões em abas e o repertório ao lado. Veja [docs/identidade-visual.md](docs/identidade-visual.md).

## Tecnologias

- Next.js 16 (App Router, Turbopack, Cache Components)
- React 19
- TypeScript em modo strict
- Tailwind CSS 4
- shadcn/ui (Button, Input, Badge, AlertDialog, Textarea e NativeSelect) e Lucide React
- Zod, para validar formulários, dados salvos e a API
- MongoDB, com Mongoose (dados da aplicação) e o driver oficial (Better Auth)
- Better Auth, com e-mail e senha
- Docker Compose, para o ambiente de desenvolvimento
- Vitest e React Testing Library
- ESLint
- pnpm

## Executar com Docker (recomendado)

Sobe o MongoDB e a aplicação em containers, com hot reload.

```bash
cp .env.example .env
openssl rand -base64 32   # copie o resultado para BETTER_AUTH_SECRET no .env
docker compose up --build
```

Acesse <http://localhost:3000>, ou a porta definida em `APP_PORT`. A aplicação só inicia depois que o MongoDB estiver saudável.

| Comando                                      | Finalidade                          |
| -------------------------------------------- | ----------------------------------- |
| `docker compose up -d`                       | Inicia em segundo plano             |
| `docker compose logs -f app`                 | Acompanha os logs da aplicação      |
| `docker compose down`                        | Encerra, preservando os dados       |
| `docker compose down -v`                     | Encerra e **apaga** os dados locais |
| `docker compose exec app pnpm test:integration` | Roda os testes contra o MongoDB  |

Dependências e build ficam em volumes próprios do container, separados dos arquivos da sua máquina. O código é montado em tempo real, e o `pnpm-lock.yaml` é reaplicado a cada início.

### Replica set

O MongoDB roda como replica set de nó único, porque transações não existem em um servidor standalone. O healthcheck do serviço `mongo` inicia o replica set automaticamente na primeira execução. Para verificar:

```bash
docker compose exec mongo bash -c 'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "rs.status().members.map(m => m.stateStr)"'
```

O resultado esperado é `[ 'PRIMARY' ]`. O banco fica exposto apenas em `127.0.0.1`.

### Contas de desenvolvimento

Com `AUTH_ALLOW_DEV_SIGNUP=true` no `.env`, crie contas em `/cadastro`. Nenhum e-mail é enviado. Em produção, o cadastro permanece fechado, mesmo com essa variável.

## Variáveis de ambiente

| Variável                | Função                                                      |
| ----------------------- | ----------------------------------------------------------- |
| `MONGODB_URI`           | Conexão com o MongoDB                                       |
| `MONGODB_DB_NAME`       | Nome do banco                                               |
| `BETTER_AUTH_SECRET`    | Segredo das sessões, com pelo menos 32 caracteres           |
| `PUBLIC_SHARING_ENABLED` | `true` ativa os links públicos. Padrão: desativado         |
| `SHARE_LINK_SECRET`     | Assina os links públicos, com pelo menos 32 caracteres      |
| `BETTER_AUTH_URL`       | Endereço público da aplicação, usado como origem confiável  |
| `AUTH_ALLOW_DEV_SIGNUP` | Permite cadastro fora de produção                           |
| `CONTRIBUTION_MAX_PENDING`, `CONTRIBUTION_MAX_PER_DAY`, `CONTRIBUTION_MAX_CHORDPRO_LENGTH` | Limites das contribuições ao catálogo. Padrão: 5 em andamento, 10 novas por dia, 50 mil caracteres |
| `APP_PORT`, `MONGO_PORT`, `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD` | Somente para o Docker Compose |

O `.env` nunca é versionado. Não crie variáveis `NEXT_PUBLIC_` com credenciais: tudo o que tem esse prefixo vai para o navegador. As variáveis são validadas na primeira requisição, e as mensagens de erro citam apenas os nomes. O `pnpm build` não exige banco nem variáveis.

## Instalação sem Docker

Requer Node.js 22.12 ou superior (versões 22 ou 24 LTS, exigência do Vitest 5) e pnpm. A versão do pnpm está fixada em `packageManager`, no `package.json`.

Se o pnpm não estiver disponível, instale-o com uma das opções:

```bash
corepack enable pnpm   # pode exigir sudo, dependendo de onde o Node está instalado
npm install -g pnpm    # alternativa
```

Depois, instale as dependências:

```bash
pnpm install
```

## Execução local

```bash
pnpm dev
```

Acesse <http://localhost:3000>. Para testar o build de produção:

```bash
pnpm build
pnpm start
```

## Testes e verificações

```bash
pnpm lint              # ESLint
pnpm exec tsc --noEmit # verificação de tipos
pnpm test              # executa os testes uma vez
pnpm test:watch        # executa os testes em modo observação
pnpm build             # build de produção
```

`pnpm test` não usa banco de dados. Os testes de integração são separados e exigem um MongoDB real:

```bash
docker compose exec app pnpm test:integration
```

Eles criam um banco temporário `repertorio_test_*`, removido ao final, e recusam qualquer host que não seja local. Sem MongoDB acessível, a suíte falha.

## Estrutura das pastas

```text
src/
  app/                    Rotas: Server Components que compõem cada tela
    (app)/                Telas com a navegação da aplicação
      preparar-missa/     Celebração da data, sugestões e repertório em construção
      celebracoes/        Busca de celebrações por título, período, tempo e situação
      admin/liturgia/     Administração do calendário: fontes, revisão e histórico
      catalogo/
      biblioteca/
      musicas/
      repertorios/
      compartilhamentos/
      conta/
    s/                    Páginas públicas de repertórios compartilhados
    api/v1/               API privada e leitura pública
  components/
    layout/               Estrutura, navegação, formulários e estados vazios
    ui/                   Componentes shadcn/ui
  features/
    library/
      components/         Leitura reativa, estados de carregamento e backup
      data/               Biblioteca da conta, adaptadores HTTP e leitura do formato salvo
      legacy/             Leitor somente leitura da biblioteca antiga do navegador
      migration/          Importação assistida e registro do importId
      domain/             Biblioteca, integridade e erros
      services/           Backup em JSON
    songs/
      components/         Telas, formulário, editor e leitor de cifra
      data/               Contrato do repositório e preferências de leitura
      domain/             Tipos, esquemas e regras (Song, MusicalKey)
      services/           Parser ChordPro, busca, filtros e formulário
    repertoires/
      components/         Telas, formulário e controles de ordenação
      data/               Contrato do repositório
      domain/             Tipos e esquemas (Repertoire, RepertoireItem)
      services/           Ordenação, itens e formulário
  lib/
    utils/                Texto, tema, IDs, downloads e avisos
  server/                 Somente no servidor
    auth/                 Better Auth, sessão e política de cadastro
    database/             Conexões e modelos Mongoose
    repositories/         Adaptadores MongoDB dos contratos existentes
    library/              Serviço de aplicação por usuário
    http/                 Autenticação de rotas, validação e erros
  test/                   Utilitários de teste e API falsa da biblioteca
tests/integration/        Suíte que exige MongoDB real
docker/mongo/             Inicialização do replica set
docs/                     Migração, compartilhamento e planejamento offline
```

Os testes ficam ao lado do código que verificam (`*.test.ts` e `*.test.tsx`).

## Como usar

**Cadastrar uma música particular:** em **Minhas músicas**, escolha **Nova música**, preencha título, artista e tom, e selecione o tipo de conteúdo. Para tipos **Própria** e **Autorizada**, escreva a cifra em ChordPro e acompanhe a prévia. Para **Link externo**, informe o endereço `http://` ou `https://` da fonte original; a cifra não é copiada.

**Preparar uma missa:** na página inicial ou em **Preparar missa**, escolha a data. A tela mostra a celebração, as referências das leituras e as sugestões para cada momento, com o motivo de cada uma. Abra a cifra, use **Adicionar** para colocar a música no repertório da missa e ajuste o tom no painel **Repertório em construção**. Cada escolha é salva na hora. Em **Revisar e concluir**, ordene, anote e compartilhe. Se a data não estiver na base, a tela informa e oferece a busca por momento, tempo e celebração.

**Consultar o catálogo:** em **Catálogo**, busque por título ou artista e combine os filtros de momento da missa, tempo litúrgico, celebração e tema. Transpor ali é temporário. Sem login, **Adicionar ao repertório** convida a entrar.

**Criar um repertório:** em **Repertórios**, escolha **Novo repertório**, dê um nome e salve. Na página do repertório, escolha **Catálogo** (padrão) para buscar e adicionar músicas globais, ou **Minhas músicas** para as particulares. Use as setas para definir a ordem. Pela página da música no catálogo, **Adicionar ao repertório** também permite escolher o repertório e o tom.

**Excluir uma música em uso:** a exclusão é bloqueada enquanto a música estiver em algum repertório. A mensagem lista quais são; remova-a deles primeiro.

**Transpor na leitura:** na página da música, use os botões **-** e **+**. Aberta pela biblioteca, a alteração é temporária e não modifica a música.

**Definir tom e anotações em um repertório:** na linha da música, escolha **Ajustar tom e anotações**. O tom é salvo a cada clique e as anotações, em **Salvar anotações**. Ao abrir a música a partir do repertório, ela aparece no tom configurado, com as anotações, e alterar o tom ali atualiza aquele repertório.

**Exportar um backup:** na página inicial, em **Seus repertórios**, seção **Backup**, escolha **Exportar backup**. O servidor monta um retrato completo e consistente da conta. O arquivo JSON contém músicas particulares e repertórios, com IDs, datas, ordem, anotações e cifras, sem sessões, credenciais, publicações ou revisões. Sem músicas do catálogo, ele mantém `schemaVersion: 1`. Com elas, usa `schemaVersion: 2` e guarda só a referência de cada uma, sem a cifra. Quando algum repertório tem dados de missa (celebração ou momento de um item), usa `schemaVersion: 3`. Backups antigos continuam válidos, e cada documento importado começa na revisão 1.

Arquivos aceitos: somente `.json`, de até 5 MB, validados pelas mesmas regras dos dados salvos, incluindo IDs únicos, referências entre músicas e repertórios, links `http(s)` e limites de tamanho. Um arquivo inválido ou uma falha ao gravar não alteram nada. Se os dados salvos estiverem danificados, a tela de recuperação também permite restaurar um backup.

## Biblioteca da conta

Toda música e todo repertório são gravados no MongoDB, pela API privada, com a sessão validada no servidor. Sem login, as telas da biblioteca convidam a entrar ou criar uma conta e não mostram dado algum.

**Ao entrar:** a biblioteca da conta é carregada. Uma conta nova começa vazia, sem exemplos.

**Ao sair:** os dados da conta são descartados da memória, e requisições pendentes são invalidadas. Nada é apagado.

**Troca de conta:** o estado da sessão anterior é descartado e só os dados da nova conta são carregados. Se outra aba trocar de conta, o servidor recusa escritas destinadas à conta anterior.

**Falhas de conexão:** com o servidor ou o MongoDB indisponível, o aplicativo avisa e oferece "Tentar novamente". Ele nunca mostra uma lista vazia, nunca usa dados deste navegador no lugar da conta e nunca informa que algo foi salvo sem a confirmação do servidor. Formulários abertos mantêm o texto. Não há fila offline.

**Vários aparelhos:** a biblioteca é relida ao recarregar, ao voltar para a aba e no botão "Atualizar". Não há atualização em tempo real.

### Edição em mais de um dispositivo

Cada música e cada repertório têm um campo `revision`, que começa em 1 e só o servidor aumenta, a cada alteração confirmada. Toda alteração informa a revisão que a tela carregou; se outra alteração veio antes, nada é gravado. **Uma alteração não sobrescreve outra em silêncio, e não há mesclagem automática.**

- **Formulários de música e repertório:** o texto digitado continua no formulário, com o aviso "Esta música foi alterada em outro dispositivo enquanto você a editava.". Dá para ver a versão atual, copiar o rascunho, sair com "Cancelar" ou descartar o rascunho e carregar a versão atual, com confirmação.
- **Tom, anotações, ordem e músicas do repertório** mudam a revisão do repertório inteiro. Uma anotação feita sobre uma versão antiga é recusada, o texto fica no campo, e "Salvar sobre a versão atual" refaz a alteração depois que a tela recarrega.
- **Cliques seguidos no tom** são gravados um de cada vez, sempre o valor mais recente, com o aviso "Salvando o tom…". Se a gravação falhar, o tom confirmado volta a aparecer.
- **Exclusões** também exigem a revisão atual: se a música ou o repertório mudou, a exclusão é recusada e precisa ser confirmada de novo.

Detalhes técnicos em [docs/concorrencia-e-revisoes.md](docs/concorrencia-e-revisoes.md).

### Recuperar uma biblioteca antiga

Versões anteriores guardavam a biblioteca no `localStorage`. **O aplicativo não apaga, não altera e não usa mais esses dados**: a chave `repertorio.biblioteca.v1` é apenas lida, e somente para recuperação.

Se houver dados antigos, a tela inicial mostra um aviso discreto. Em **Minha conta**, escolha **Importar biblioteca antiga** para ver a quantidade de músicas e repertórios, baixar um backup JSON e importar. Também é possível usar um arquivo de backup. A importação nunca é automática e não bloqueia o restante do aplicativo.

- **Confirme que os dados são seus.** Eles estão vinculados ao navegador, e não a uma conta.
- **Só para uma conta vazia.** Se a conta já tem músicas ou repertórios, nada é importado nem substituído, e o backup continua disponível. A importação para uma conta preenchida ainda não é suportada.
- **Resultado incerto.** Se a conexão cair ou o servidor responder 503, o aplicativo consulta o resultado e oferece "Verificar novamente". O mesmo `importId` nunca gera uma segunda cópia, e a tentativa é recuperada ao recarregar.
- **Dados danificados** nunca são sobrescritos: a ferramenta oferece baixar o conteúdo original.
- **Apagar deste navegador.** Na mesma tela, "Apagar biblioteca antiga deste navegador" remove só a chave antiga, depois de mostrar as quantidades e pedir confirmação. Conta, links públicos, sessão e preferências não são tocados, e a exclusão nunca é automática, nem depois de importar. Baixe um backup antes: os dados podem não estar na conta.

Detalhes em [docs/migracao-localstorage-mongodb.md](docs/migracao-localstorage-mongodb.md).

## Compartilhamento público

Um repertório da **biblioteca da conta** pode virar um link que qualquer pessoa abre sem login. O repertório continua privado: o link mostra uma **publicação**, uma cópia separada do que você autorizou.

O recurso vem **desativado**, inclusive em produção. Para ativar no Docker, acrescente ao `.env` e recrie o container:

```bash
PUBLIC_SHARING_ENABLED=true
SHARE_LINK_SECRET=<resultado de: openssl rand -base64 32>
```

```bash
docker compose --env-file .env up -d app
```

A flag protege criação, atualização e acesso público no servidor. Revogar continua possível com o recurso desligado. **Perder ou trocar `SHARE_LINK_SECRET` invalida todos os links existentes.**

**Publicar:** no repertório, escolha **Compartilhar repertório** e **Criar novo link**. Confirme música por música quais cifras podem ser distribuídas, veja a prévia e publique. Depois, use **Copiar link**.

| Público | Permanece privado |
| --- | --- |
| Nome e descrição do repertório | Anotações dos itens |
| Título, artista e tom de cada música, na ordem | E-mail, sessão e dados de conta |
| Tom do item | Identificadores internos |
| Cifra, somente com a sua confirmação individual | Cifras não confirmadas |
| Endereço de links externos | Outros repertórios |

**Cifras.** O tipo "Autorizada" não dispensa a confirmação. Sem ela, só título, artista e tom são publicados. A declaração fica registrada com data e versão, mas não substitui uma licença real nem uma moderação. Links externos publicam apenas o endereço: nada é copiado ou incorporado.

**Músicas do catálogo.** Quem decide é a plataforma, não a sua confirmação: a cifra entra no link só se a música tiver direito de redistribuição. Esse direito e a publicação são conferidos de novo a cada abertura do link. Se a música for despublicada ou perder o direito, o link passa a mostrá-la como indisponível.

**Snapshot.** Alterar o repertório não altera o link. O link continua igual até você escolher **Atualizar publicação**, ver a prévia e confirmar. A tela avisa quando a publicação difere da biblioteca e lista músicas que saíram do repertório, mas continuam visíveis no link.

**Revogar.** O link para de funcionar na hora, o conteúdo publicado é apagado e não há como reativá-lo. Excluir um repertório revoga os links dele na mesma operação.

**Link público não é catálogo.** Não há busca nem listagem, e as páginas têm `noindex`. Isso não é controle de acesso: quem tiver o link consegue abrir, e pode repassá-lo.

Limites padrão, ajustáveis por variáveis `SHARE_MAX_*`: 10 links por repertório, 50 por conta, 200 músicas por publicação, snapshot de até 4 MB e 60 criações ou atualizações por hora.

Detalhes em [docs/compartilhamento-publico.md](docs/compartilhamento-publico.md).

## Preparação da missa e classificação litúrgica

- **Celebrações:** base editorial no MongoDB (`liturgical_celebrations`), com título, grau, tempo, cor e referências das leituras. Cada celebração registra as fontes e o que cada uma confirma; o que nenhuma fonte confirma aparece como inferência. Uma data pode ter várias celebrações ou formulários de missa. Datas fora da base não recebem dados estimados, e os textos das leituras não são reproduzidos.
- **Revisão editorial:** toda celebração começa em revisão. Só uma pessoa da administração aprova, em `/admin/liturgia`, declarando que conferiu nas fontes. Editar uma celebração revisada a devolve à revisão. Cada alteração fica no histórico. Enquanto os dados não estão revisados, ou faltam leituras, as sugestões aparecem como provisórias.
- **Busca de celebrações:** `/celebracoes`, por título, período, tempo litúrgico e situação, paginada.
- **Classificação:** a administração classifica cada música do catálogo por tipo de uso, momentos da missa, tempos, celebrações, temas, referências bíblicas estruturadas, fonte de orientação e justificativa, em `/admin/catalogo`. Pode salvar incompleta; só a classificação completa pode ser conferida por uma pessoa, que registra a fonte consultada. Divergências tiram a música das sugestões. Classificar não altera direitos nem a situação de publicação.
- **Sugestões:** cada uma diz se a classificação foi conferida e se há cifra; quando não há sugestão, a tela diz se faltam músicas, classificações ou músicas adequadas. Primeiro valem as restrições (canto devocional não é sugerido para a missa; o Glória não aparece nos domingos do Advento e da Quaresma; o salmo é o do Lecionário), depois a ordem: celebração, leituras, tempo e temas. Cada sugestão mostra de onde veio.
- **Repertório da missa:** um repertório pode guardar a data e a celebração, e cada item, o momento. Esses dados são opcionais: repertórios de ensaio e os anteriores continuam como estão.
- **Link público:** publica o nome da celebração e o momento de cada música. A data só entra se você marcar essa opção.

**Importar a base editorial (somente desenvolvimento).** O calendário começa vazio. As nove celebrações conferidas na Etapa 2E.2 entram só por comando explícito, sempre em revisão. O comando é idempotente, recusa `NODE_ENV=production` e nunca altera uma celebração existente:

```bash
docker compose exec app pnpm liturgy:import
```

O modelo editorial, as fontes, a revisão, a auditoria, a cobertura real e a viabilidade de um calendário automático estão em [docs/curadoria-liturgica.md](docs/curadoria-liturgica.md). A classificação das músicas e as regras de recomendação estão em [docs/arquitetura-liturgica.md](docs/arquitetura-liturgica.md).

## Catálogo central

Músicas globais da plataforma, na coleção `catalog_songs`, separadas das bibliotecas particulares. Qualquer pessoa busca e lê as publicadas em **Catálogo** (`/catalogo`). Contas autenticadas as adicionam aos repertórios só como referência, com tom e anotações próprios em cada repertório.

- **Direitos:** cada música registra fundamento, evidência, quem aprovou e quando. Exibir a cifra, redistribuí-la em links públicos e mostrar o link externo são permissões separadas. Sem permissão, aparecem só título, artista e tom (quando conhecido). Classificação litúrgica e subsídios da CNBB não concedem direito de reprodução.
- **Cadastro em etapas** (identificação, conteúdo, classificação, direitos e revisão): o rascunho pode ter só o título. Nada é suposto: sem tom confirmado, a música fica só com metadados.
- **Importação de metadados** em `/admin/catalogo/importar`: prévia sem gravar, duplicatas apontadas, confirmação explícita, só rascunhos, idempotente. O primeiro catálogo real (30 músicas de subsídios da CNBB, de dioceses e hinos tradicionais) acompanha o projeto e **não é importado automaticamente**; veja [docs/catalogo-editorial.md](docs/catalogo-editorial.md).
- **Despublicar** retira a música do catálogo, mas não altera repertórios: o item fica salvo e aparece como "Música indisponível no catálogo".
- **Itens antigos**, sem origem gravada, continuam sendo músicas particulares. Não há migração destrutiva.

**Administração.** A área `/admin/catalogo` só existe para contas com o papel administrativo. O papel é concedido exclusivamente pela linha de comando, para uma conta já cadastrada:

```bash
docker compose exec app pnpm catalog:admin grant --email pessoa@exemplo.com
docker compose exec app pnpm catalog:admin revoke --email pessoa@exemplo.com
docker compose exec app pnpm catalog:admin list
```

**Músicas de exemplo (somente desenvolvimento).** Quinze músicas fictícias, inseridas só por comando explícito: cinco sem classificação e dez cantos com classificação litúrgica, para a preparação da missa. O comando é idempotente, recusa `NODE_ENV=production` e nunca altera músicas existentes:

```bash
docker compose exec app pnpm catalog:seed
```

### Contribuições

Na página de uma música particular, **Sugerir para o catálogo** envia uma cópia dela para análise; nada é publicado sem a decisão de uma pessoa da administração. A pessoa acompanha a situação (em análise, precisa de correções, aprovada, recusada, retirada) em **Minha conta → Minhas sugestões**. A administração revisa em `/admin/contribuicoes`: aprova como música nova (só metadados ou também letra e cifra, quando a autorização foi declarada) ou como complemento de uma música existente, pede correções ou recusa, sempre com a revisão esperada. Fluxo, direitos, duplicatas, vídeo, crédito, limites e concorrência em [docs/contribuicoes-catalogo.md](docs/contribuicoes-catalogo.md).

Modelo, busca, contratos HTTP, índices e limitações estão em [docs/catalogo-central.md](docs/catalogo-central.md). Cadastro em etapas, revisão da classificação, importação, fontes do catálogo real e diagnóstico das sugestões estão em [docs/catalogo-editorial.md](docs/catalogo-editorial.md).

## Arquitetura de dados

```text
Telas → repositórios e useLibrary → accountLibrary → RemoteLibrary → repositórios HTTP
  → /api/v1/library → serviços → repositórios Mongoose → MongoDB
```

- `accountLibrary` conhece a sessão e mantém uma instância remota por login. Nenhum dado sobrevive à troca de conta.
- Os dados da conta ficam somente em memória; nunca são gravados no navegador. O `localStorage` guarda apenas preferências, o registro de uma importação em andamento e, em instalações antigas, a biblioteca legada intocada.
- Sucesso só é informado depois da confirmação da API, e a lista é relida após cada alteração.
- O leitor legado (`features/library/legacy`) é isolado: não é fonte de dados de nenhuma tela da biblioteca.

### Links dependem da conta

Um link como `/musicas/<id>` só funciona para a conta dona da música. **Enviá-lo a outra pessoa não compartilha a música.** Para isso existem os links públicos de repertórios.

## Formato de cifra (ChordPro simplificado)

| Marcação                                       | Significado                      |
| ---------------------------------------------- | -------------------------------- |
| `[G]`                                          | Acorde na posição em que aparece |
| `{title: …}`, `{artist: …}`, `{key: …}`        | Metadados, não exibidos na cifra |
| `{comment: …}` ou `{c: …}`                     | Anotação visível, como "Intro"   |
| `{start_of_verse}` / `{end_of_verse}`          | Estrofe (`{sov}` / `{eov}`)      |
| `{start_of_chorus}` / `{end_of_chorus}`        | Refrão (`{soc}` / `{eoc}`)       |
| `# texto`                                      | Comentário interno, não exibido  |

Outras diretivas são ignoradas e nunca aparecem como texto para o usuário.

## Transposição

As funções puras ficam em `features/songs/domain/transposition.ts`. O fluxo de leitura é:

```text
ChordPro original → parser → modelo interpretado → transposição dos acordes → renderização
```

O texto ChordPro salvo nunca é modificado, e letras, comentários e quebras de linha não são tocados.

- **Tom original e tom exibido:** o `originalKey` da música nunca muda ao transpor. O tom exibido é sempre derivado do tom original e do deslocamento em semitons.
- **Grafia:** subindo, usa sustenidos; descendo, bemóis. Deslocamento zero mantém a grafia original.
- **Sufixos:** apenas a fundamental e o baixo são transpostos (`F#m7b5/C#` + 1 = `Gm7b5/D`).
- **Marcações não reconhecidas**, como `N.C.`, `%` ou textos entre colchetes, são exibidas sem alteração.
- **Notação:** somente a internacional (C, D, E, F, G, A, B).

## Modo apresentação

Na página da música, escolha **Apresentar**. A cifra ocupa toda a tela, acima da navegação do aplicativo, com a saída sempre visível. O botão de ajustes revela tom, fonte e velocidade.

- **Tamanho da fonte:** de 14 a 30 px, em passos de 2 px, também disponível na leitura normal.
- **Rolagem automática:** de 10 a 80 pixels por segundo. Sempre começa pausada e só inicia por ação sua. Pausa ao rolar manualmente, ao ocultar a aba, ao trocar de música, ao sair e ao chegar ao fim, e não retoma sozinha.
- **Navegação entre músicas:** aberta a partir de um repertório, a música mostra sua posição e permite ir à anterior ou à próxima, seguindo a ordem do repertório e usando o tom e as anotações de cada item. Não há retorno automático à primeira música.

Fonte e velocidade ficam salvas na chave `repertorio.reader.preferences.v1`, separada da biblioteca. Dados inválidos nessa chave apenas retornam aos valores padrão.

| Tecla    | Ação                       |
| -------- | -------------------------- |
| Espaço   | Inicia ou pausa a rolagem  |
| → e ←    | Próxima e música anterior  |
| Esc      | Sai do modo apresentação   |

Os atalhos não agem em campos de texto, e a barra de espaço mantém sua função nativa quando um botão está em foco.

### Tela cheia

O botão de tela cheia só aparece quando o navegador oferece a Fullscreen API e sempre depende de um clique. O modo apresentação funciona igualmente sem ela. O Safari do iPhone não oferece essa API para páginas. Quando a tela cheia estiver ativa, o navegador usa a primeira tecla Esc para sair dela; uma segunda sai do modo apresentação.

### Tom por repertório

O deslocamento fica em `transposeSemitones`, no item do repertório. A mesma música pode ter um tom diferente em cada repertório.

**O deslocamento é relativo ao tom original.** Se o tom original da música mudar, o item mantém os semitons e o tom exibido acompanha: uma música em G com +2 aparece em A; se o tom original passar a ser C, ela aparece em D.

O contexto de leitura usa `/musicas/<id>?repertoireId=...&itemId=...`. Esses IDs só valem para a conta dona do repertório. Link inválido cai na leitura normal, com o aviso correspondente.

## Arquitetura MongoDB e contas

- **Better Auth** usa o driver oficial `mongodb` e o adaptador oficial, com transações. Hashing de senha, sessões, cookies e checagem de origem ficam com a biblioteca. Suas coleções são `user`, `session`, `account` e `verification`.
- **Mongoose** guarda os dados da aplicação nas coleções `songs` e `repertoires`, e o catálogo em `catalog_songs` e `catalog_admins`. Os esquemas Zod do domínio continuam sendo a fonte das regras.
- **Autorização:** `ownerId` vem sempre da sessão validada no servidor e faz parte de todas as consultas. Um recurso de outro usuário responde exatamente como um inexistente.
- **Integridade:** adicionar uma música a um repertório e excluí-la são transações que escrevem no documento da música, o que força um conflito entre elas. Por isso é necessário um replica set.
- **Conexões** são únicas por processo e reutilizadas no hot reload. Nenhum dado privado usa `use cache`.

### Índices

| Coleção       | Índice                  | Finalidade                       |
| ------------- | ----------------------- | -------------------------------- |
| `songs`       | `ownerId + id` (único)  | Identidade por usuário           |
| `songs`       | `ownerId + title`       | Listagem ordenada                |
| `repertoires` | `ownerId + id` (único)  | Identidade por usuário           |
| `repertoires` | `ownerId + updatedAt`   | Listagem por alteração recente   |
| `library_states` | `ownerId` (único)    | Serializar importações e criações |
| `library_imports` | `ownerId + importId` (único) | Idempotência da importação |
| `catalog_songs` | `id` (único); `status + sortTitle + id`; `status + searchTokens` | Catálogo: identidade, listagem e busca |
| `catalog_admins` | `userId` (único) | Papel de administração do catálogo |
| `liturgical_celebrations` | `id` (único); `country + dioceseKey + date + celebrationKey + massVariant` (único); por data, situação, tempo e título | Calendário editorial |
| `liturgical_celebration_history` | `id` (único); `celebrationId + toRevision` | Histórico editorial |

Coleções e índices são criados de forma explícita a cada conexão, o que permite recuperar o serviço depois de uma falha do banco.

### API privada

Todas as rotas exigem sessão válida e aceitam apenas JSON. O limite é de 512 KB, ou cerca de 5 MB nas rotas de importação. O campo `ownerId` enviado pelo cliente é rejeitado.

| Rota                                                  | Métodos            |
| ----------------------------------------------------- | ------------------ |
| `/api/v1/library/songs`                               | GET, POST          |
| `/api/v1/library/songs/[id]`                          | GET, PUT, DELETE   |
| `/api/v1/library/repertoires`                         | GET, POST          |
| `/api/v1/library/repertoires/[id]`                    | GET, PUT, DELETE   |
| `/api/v1/library/repertoires/[id]/items`              | POST               |
| `/api/v1/library/repertoires/[id]/items/[itemId]`     | PATCH, DELETE      |
| `/api/v1/library/repertoires/[id]/items/[itemId]/move`| POST               |
| `/api/v1/library/import/preview`                      | POST               |
| `/api/v1/library/import`                              | POST               |
| `/api/v1/library/imports/[importId]`                  | GET                |

Os erros seguem o formato `{ "error": { "code", "message" } }`, com status 400, 401, 403, 404, 409, 413, 415, 500 ou 503.

O catálogo tem uma API pública de leitura (`/api/v1/catalog/songs`) e uma de administração (`/api/v1/admin/catalog/songs`), descritas em [docs/catalogo-central.md](docs/catalogo-central.md). As contribuições usam `/api/v1/catalog/submissions` (conta da sessão) e `/api/v1/admin/catalog/submissions` (administração), descritas em [docs/contribuicoes-catalogo.md](docs/contribuicoes-catalogo.md#endpoints).

### Importação para a conta

Importa de uma só vez um backup JSON, em transação, para a conta da sessão. A referência completa de contrato, concorrência e idempotência está no [plano de migração](docs/migracao-localstorage-mongodb.md). Em resumo:

- Só importa se a biblioteca remota da conta estiver vazia; caso contrário, responde 409 e não altera nada.
- Preserva IDs, datas, ordem, tons e anotações, e nunca aceita `ownerId` no conteúdo.
- Cada tentativa usa um `importId` (UUID). Repetir com o mesmo conteúdo devolve o resultado anterior, sem duplicar.
- Se a resposta se perder, consulte `GET /api/v1/library/imports/[importId]` antes de tentar outra importação.

### Cuidados com segredos

Nunca versione o `.env`, e use segredos diferentes em cada ambiente. O Compose usa credenciais apenas de desenvolvimento e não é adequado para produção. A aplicação não registra valores de variáveis nem mensagens do driver.

### Pendências antes de produção

**A plataforma não está pronta para produção.** Antes disso, são necessários:

- Verificação de e-mail, com um provedor real.
- Recuperação de senha.
- Proteção contra abuso e revisão do cadastro público.
- Rate limiting com armazenamento compartilhado. O padrão fica em memória e depende de um IP confiável (`trustedProxies`).
- Domínio com HTTPS e `BETTER_AUTH_URL` correspondente.
- Gestão operacional de segredos e imagem Docker de produção.

## Limitações atuais

- O controle de versão é por documento: alterações em itens diferentes do mesmo repertório, feitas ao mesmo tempo em dois aparelhos, também geram conflito. Não há histórico de versões nem mesclagem.
- A importação de uma biblioteca antiga só é aceita para uma conta vazia.
- Não há suporte offline: sem servidor, a biblioteca fica indisponível.
- Se a sessão expirar com um formulário alterado, o texto fica em tela, somente na memória da aba, até você entrar de novo com a mesma conta. Fechar ou atualizar a aba perde esse texto. Se outra conta assumir o navegador, ele é descartado.
- Encerrar a sessão em outra aba mostra "Sua sessão expirou" nesta aba.
- Não há colaboração nem cobrança.
- A base de celebrações cobre 9 datas, entre 15/11/2026 e 01/01/2027, todas ainda em revisão, com dois salmos não conferidos. Nenhuma fonte automatizada confiável cobre o calendário brasileiro com licença adequada. Não há calendário completo, reprodução de áudio, regras para o Tríduo Pascal e os dias de semana, nem precedência entre calendário diocesano e nacional.
- O primeiro catálogo real tem 30 músicas só com metadados, conferidas por leitura automatizada das fontes, sem revisão humana: entram como rascunho, com a classificação não conferida, e só aparecem depois que a administração revisa e publica. Não há letra, cifra nem tom dessas músicas.
- A busca do catálogo encontra o começo das palavras, sem relevância nem tolerância a erros. O tom original de uma música do catálogo não muda depois de publicada. Veja as demais limitações em [docs/catalogo-central.md](docs/catalogo-central.md#limitações).
- Contribuições: a detecção de duplicatas compara títulos normalizados (sem títulos alternativos, que ainda não existem no modelo); os termos da declaração de direitos ainda dependem de revisão jurídica antes da abertura pública. Veja [docs/contribuicoes-catalogo.md](docs/contribuicoes-catalogo.md#limitações-conhecidas).
- A grafia enarmônica segue a direção da transposição, sem análise harmônica do tom, e ainda não pode ser escolhida na interface.
- Um backup exportado acima de 5 MB não pode ser reimportado pela ferramenta atual.
- Atualizar a página durante o modo apresentação volta à leitura normal da música atual.
- O suporte foi validado no Chrome, em computador e em emulação de celular. Safari, iOS e aparelhos físicos ainda não foram testados.
- Impressão: as folhas de continuação não repetem o título da música, e não há escolha de papel, margens ou tamanho de letra. A paginação foi validada só no Chrome. Veja [docs/leitura-e-impressao.md](docs/leitura-e-impressao.md#limitações).
- Como os dados são carregados no cliente, `/musicas/<id>` e `/repertorios/<id>` respondem HTTP 200, e a tela de "não encontrado" é decidida no cliente. Essas páginas têm `noindex`.

## Próximas etapas

- **Recursos ainda não disponíveis:** capotraste, diagramas de acordes, metrônomo, áudio e uso offline completo.
- **Uso offline:** planejado como cache somente leitura, ver [docs/cache-offline-futuro.md](docs/cache-offline-futuro.md).
- **Calendário litúrgico:** ampliar a cobertura com uma fonte verificada do calendário do Brasil, ver a investigação em [docs/curadoria-liturgica.md](docs/curadoria-liturgica.md#integração-automatizada-viabilidade).
- **Etapas posteriores:** colaboração e ampliação do catálogo, sempre com direitos registrados.
