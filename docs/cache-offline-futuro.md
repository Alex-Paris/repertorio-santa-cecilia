# Cache offline futuro: decisão de arquitetura

**Situação:** planejamento apenas. Nada aqui foi implementado. Não há Service Worker, IndexedDB para cifras nem dependências de PWA.

## Decisão

O uso sem internet, quando existir, será um **cache somente leitura** da biblioteca da conta. O MongoDB continua sendo a única fonte editável.

Não haverá uma segunda biblioteca editável, fila de escritas offline nem sincronização bidirecional. A Etapa 2C.2 removeu justamente esse tipo de duplicidade.

## Comportamento planejado

- O usuário escolhe músicas ou repertórios para baixar e usar sem internet.
- Mais tarde, pode existir uma opção de cache automático, configurável e desligada por padrão.
- Sem conexão, o conteúdo baixado aparece identificado como cópia e com a data da última atualização.
- Toda edição exige conexão. Sem ela, os controles de edição ficam indisponíveis.

## Tecnologia a avaliar

| Peça            | Uso previsto                                                   |
| --------------- | -------------------------------------------------------------- |
| Service Worker  | Abrir a aplicação sem rede                                     |
| IndexedDB       | Guardar cifras e repertórios baixados, por conta               |
| Storage API     | `navigator.storage.estimate()` e pedido de persistência        |

## Riscos a tratar antes de implementar

**Limites de armazenamento.** O navegador pode descartar os dados, e a cota varia. O cache **não pode ser considerado permanente**: a interface precisa lidar com a ausência a qualquer momento e mostrar quanto espaço está em uso.

**Privacidade e logout.** Dados offline são dados privados em disco, diferente da memória usada hoje. O logout deve apagar o cache da conta, e cada conta precisa de um espaço separado. O aviso ao usuário deve deixar claro que há cópia no aparelho, o que importa em computadores compartilhados.

**Sessão expirada.** Definir por quanto tempo o conteúdo já baixado continua legível sem validar a sessão no servidor.

**Conteúdo público revogado.** Uma publicação revogada não pode continuar sendo servida. Links públicos não devem entrar em cache por padrão; se entrarem, precisam revalidar antes de exibir e apagar a cópia ao receber indisponível. A revogação não alcança um aparelho que está sem rede, e isso deve ser dito ao proprietário.

**Respostas `no-store`.** A API privada usa `Cache-Control: private, no-store` e links públicos usam `no-store`. O cache offline deve ser uma cópia explícita em IndexedDB, nunca uma flexibilização desses cabeçalhos ou o Cache Storage do Service Worker sobre rotas privadas.

**Versões.** Cifras baixadas precisam de `updatedAt` e de versão de formato, para atualizar ou descartar a cópia.

**Direitos autorais.** Cópias offline de conteúdo de terceiros exigem revisão, assim como os links públicos.
