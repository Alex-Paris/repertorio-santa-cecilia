# Privacidade, termos e preparação para Facebook Login

Data da revisão: 22/11/2026. Este relatório descreve o código desta entrega, sem presumir acesso ao painel da Vercel, ao Atlas, à caixa de e-mail ou ao aplicativo Meta de produção.

## Resultado da inspeção

- As rotas `/privacidade`, `/termos-de-uso` e `/exclusao-de-dados` não existiam. Foram criadas na árvore pública `(app)`, sem leitura de sessão, consulta ao banco ou formulário que apague dados. O rodapé da aplicação e o das páginas compartilhadas apontam para elas.
- Responsável e canal públicos fornecidos pelo mantenedor: **Alex de Lima Paris**, **me@alexparis.dev**. Estão centralizados em `src/lib/site.ts`. Não foi enviado e-mail de teste ou de atendimento.
- Facebook já estava preparado em `src/server/auth/facebook-config.ts` e `auth.ts`: credenciais somente no servidor, permissões `email` e `public_profile`, tokens de acesso OAuth criptografados, confirmação de e-mail quando necessária, criação de contas comuns e associação implícita de contas desativada. A configuração foi preservada; não há autenticação paralela.
- `FACEBOOK_CLIENT_ID` e `FACEBOOK_CLIENT_SECRET` já constam no exemplo de ambiente e no Compose. Nenhuma credencial real foi adicionada ao código ou ao Git.
- O Better Auth oferece exclusão de usuário, mas `user.deleteUser.enabled` **não está habilitado** nesta aplicação. Não existe interface, confirmação de intenção, fila de pedidos, bloqueio individual para exclusão ou limpeza integral da biblioteca vinculada. A página de instruções não altera essa configuração.
- Não existe callback Meta que valide `signed_request`, inicie uma exclusão e devolva código de confirmação e URL de status. Não cadastrar a página HTML como se fosse esse callback.

## Páginas para configurar na Meta

O domínio institucional já declarado em `src/lib/site.ts` é `https://repertoriosantacecilia.com.br`. Após a publicação manual desta versão, verificar acesso anônimo e HTTPS no domínio efetivamente usado antes de cadastrar:

| Campo no aplicativo Meta | URL preparada |
| --- | --- |
| Política de Privacidade | `https://repertoriosantacecilia.com.br/privacidade` |
| Termos de Uso | `https://repertoriosantacecilia.com.br/termos-de-uso` |
| Instruções para exclusão de dados, quando o painel oferecer essa opção | `https://repertoriosantacecilia.com.br/exclusao-de-dados` |
| Retorno OAuth do Facebook Login | `https://repertoriosantacecilia.com.br/api/auth/callback/facebook` |

Se o domínio de produção for outro, usar esse domínio nos campos, em `SITE_URL` e em `BETTER_AUTH_URL`. As páginas são públicas e independem do MongoDB, mas não foram publicadas por esta tarefa. HTTPS e o certificado do domínio são fornecidos pela hospedagem; a criação dos arquivos não verifica o certificado ou o deploy atual.

Na Vercel, configurar `FACEBOOK_CLIENT_ID` com o App ID e `FACEBOOK_CLIENT_SECRET` com o App Secret no ambiente correto, sem prefixo `NEXT_PUBLIC_`. O cadastro público continua exigindo `AUTH_ALLOW_SIGNUP=true`, Resend configurado e origem HTTPS. As páginas não ativam o aplicativo Meta nem concedem papéis administrativos.

## Processo operacional manual de atendimento

O canal é o e-mail público acima, que o responsável informou acompanhar. O link `mailto` apenas prepara uma mensagem; o visitante precisa enviá-la. Não há protocolo de atendimento emitido pela aplicação. A operação deve adotar os passos seguintes, com registros mínimos e acesso restrito:

1. **Receber e delimitar.** Registrar data de recebimento, pedido e forma de retorno em um controle privado do responsável. Distinguir acesso/correção, retirada de crédito, revogação de um link, exclusão da biblioteca e encerramento integral. Não registrar senhas, tokens, cookies ou cópias desnecessárias de documentos.
2. **Verificar a titularidade.** Preferir a confirmação pelo e-mail já cadastrado. Se o titular perdeu esse acesso, combinar evidência proporcional antes de qualquer ação destrutiva. Nome ou e-mail alegado por terceiros e um link público não bastam. Em conta Facebook, relacionar o ID interno da conta ao identificador do provedor; nunca pedir senha do Facebook. Em representação legal, verificar também a representação.
3. **Localizar sem alterar.** Uma pessoa autorizada ao banco identifica a conta exata e inventaria os vínculos abaixo. Conferir projeto, banco e tipo do ID antes de qualquer escrita. O adaptador pode gravar IDs de autenticação como `ObjectId`, enquanto os modelos de domínio guardam o ID como texto. Não presumir que remover um documento `user` resolve o pedido.
4. **Preparar a execução.** Oferecer a exportação da biblioteca quando desejada e possível. Para um pedido de acesso mais amplo, reunir os demais dados de conta, compartilhamento e contribuições: o backup da biblioteca não cobre tudo. Definir quais registros devem ser removidos, quais precisam de análise de direitos de terceiros e se existe hipótese legal de conservação, com justificativa e prazo. Para atendimento de acesso, observar o art. 19 da LGPD, sem usar o prazo de quinze dias como promessa universal de exclusão.
5. **Executar em condições controladas.** Em encerramento integral, combinar a janela de manutenção e suspender os acessos privados durante a operação por meio do controle operacional da hospedagem, para evitar novas escritas ou logins concorrentes. Esse bloqueio individual não existe na aplicação; a operação deve assegurar a restrição antes da execução. Revogar todas as sessões da conta e os links públicos; a atualização de revogação existente incrementa a versão do token e remove `snapshot` e `contentHash`. A execução no banco deve ser revisada, limitada ao usuário confirmado e feita por operador autorizado. Não executar uma limpeza destrutiva se não for possível restringir concorrência e conferir o escopo.
6. **Eliminar ou tratar os vínculos.** Remover os dados privados e de acesso aprovados para eliminação; revisar, eliminar ou efetivamente anonimizar dados pessoais em contribuições e históricos, conforme o caso. Nas músicas e celebrações editoriais, preservar direitos e registros de outros titulares: não apagar indiscriminadamente obras, catálogos ou histórias inteiras. Pseudonimizar um ID, deixando vínculos que reidentificam a pessoa, não equivale a anonimização. Validar as regras e revisões dos modelos; não usar alterações em massa por coincidência de nome.
7. **Conferir o resultado.** Fazer nova busca pelos identificadores da conta e pelas referências de contribuição; conferir que sessões antigas não autenticam e que os links públicos revogados não abrem. Revisar eventuais operações que já estavam em andamento durante a manutenção. Identificar dados ainda presentes em logs, backups e prestadores e programar o tratamento aplicável; uma cópia restaurada não pode reintroduzir silenciosamente dados já eliminados. Se o titular se cadastrar novamente depois, trata-se de uma nova conta, não de restauração automática da anterior.
8. **Responder e registrar o mínimo.** Informar o que foi executado, os dados eventualmente conservados, motivo, prazo e limitações verificadas. Não declarar que cópias externas, arquivos do usuário, backups ou permissões da Meta foram eliminados sem comprovação. Remover o vínculo local com Facebook não revoga, por si, uma autorização na Meta; orientar a remoção do aplicativo na conta Facebook ou usar procedimento externo autorizado. Conservar apenas a evidência de atendimento necessária, com prazo definido pelo responsável.

Este é um procedimento de operação humana com acesso autorizado à infraestrutura, não um script executado ou uma garantia de exclusão automática. Nenhum desses passos destrutivos foi executado em dados reais nesta entrega.

## Inventário para localizar os dados

| Coleção ou armazenamento | Vínculos a conferir |
| --- | --- |
| `user`, `account`, `session` | `_id` do usuário; `userId` nas associações e sessões; e-mail, imagem, hashes, tokens e identificação do Facebook. Verificar o tipo do identificador e tratar as credenciais antes de encerrar o acesso. |
| `verification` | Tokens/estados temporários identificáveis na estrutura efetivamente usada pelo Better Auth. Não apagar todos os registros nem usar uma busca genérica por texto. Links JWT de confirmação não são uma coleção de pedidos; a identidade associada deve ser invalidada pela remoção correta da conta. |
| `songs`, `repertoires`, `library_states`, `library_imports` | `ownerId`; conteúdo privado, notas, datas e metadados de importação/revisão. |
| `repertoire_shares`, `share_rate_limits` | `ownerId`, `repertoireId`, cópia pública, autorizações e contadores. Revogar/remover conteúdo publicado antes de declarar que um link deixou de funcionar. |
| `catalog_submissions`, `catalog_submission_quotas` | `submittedBy`, `userId`, versões, `history.by`, `review.by`, mensagens, declarações e nome escolhido como crédito. Pedidos do usuário e ações que ele realizou como administrador podem aparecer em documentos de outros titulares. |
| `catalog_songs` | Relações por `contributions.submissionId`; crédito público, vídeo e seus identificadores de contribuição; responsáveis em direitos, classificação, revisão, vídeo e aprovação. Não confundir o autor da obra com o titular que enviou uma proposta. |
| `catalog_admins` | `userId` e eventual identificação de quem concedeu o papel em `grantedBy`/`note`. Não retirar o acesso do último operador antes de manter um responsável capaz de concluir a manutenção. |
| `liturgical_celebrations`, `liturgical_celebration_history` | `createdBy`, `updatedBy`, responsáveis por aprovação/divergência, `actor`, notas e conteúdo histórico que possa identificar pessoas. Preservar a consistência da base editorial ao tratar dados pessoais. |
| Vercel, Atlas, Resend e e-mail de atendimento | Logs, entregas de mensagens, backups e registros de atendimento. Os ciclos e os controles dependem das configurações reais, ainda não auditadas. |
| Dispositivos e destinatários | Tema, preferências de leitura, biblioteca legada, arquivos JSON, impressões e cópias externas não podem ser apagados remotamente por esta aplicação. Orientar os titulares sobre o que está sob seu controle. |

Recursos existentes ajudam em partes do processo: exportação de biblioteca, exclusão de músicas/repertórios conforme suas regras, revogação de links e retirada de propostas elegíveis. `removeFromCatalogSong` permite à administração remover vídeo/crédito de uma publicação específica, mas não é uma limpeza completa de conta. Nenhum desses recursos isolados substitui a análise integral acima.

## Informações reais ainda a confirmar pelo responsável

O nome e o e-mail de atendimento já foram fornecidos e preenchidos. Ainda precisam de confirmação operacional:

- Se o serviço é mantido por Alex como pessoa física ou em nome de uma entidade; identificação e endereço de atendimento da entidade, quando aplicáveis. A marca ou o crédito da ilustração não foram tratados como prova de quem controla os dados.
- Quem opera o banco e atende o canal, como organiza e acompanha os pedidos, como verifica titularidade em casos de perda de e-mail e qual é a janela viável de manutenção para exclusão manual.
- Prazos e hipóteses de retenção de conta, logs, backups, mensagens, atendimento e registros editoriais, incluindo a rotina de expiração de backups e o tratamento após restauração.
- Regiões e contratos do Atlas/Vercel, regiões e retenção do Resend, provedor do e-mail de atendimento e eventuais transferências internacionais e salvaguardas aplicáveis.
- Fundamentos legais documentados de cada operação, especialmente quando conteúdo vinculado a uma pessoa puder revelar convicção religiosa; avaliar as condições do art. 11 da LGPD. Não foi criado consentimento específico, prova de aceite de termos ou política operacional de menores por meio de uma frase nas páginas.
- Política de uso por crianças/adolescentes e controles adequados ao público efetivo; o cadastro atual não verifica idade nem representação/consentimento parental.
- Se haverá indicação formal de encarregado, quando aplicável, e o respectivo contato. A informação de responsável pelo site não foi convertida automaticamente em nomeação formal de encarregado.
- Domínio e certificado efetivamente ativos, aplicativo Meta, configurações de publicação/revisão e credenciais de produção. Nenhum painel foi alterado por esta tarefa.

## Funcionalidades que continuam ausentes

- Fluxo de pedido autenticado com confirmação segura, inclusive para contas somente Facebook, acompanhamento e protocolo.
- Bloqueio individual e tratamento de concorrência durante o encerramento.
- Limpeza transacional e testada de todas as coleções, anonimização validada de histórico e tratamento de contribuições publicadas.
- Integração de retenção e expurgo de backups/logs, registro mínimo auditável de atendimento e exportação integral dos dados pessoais.
- Callback Meta com validação de assinatura e URL de status, se essa modalidade for escolhida. A página atual é de instruções por e-mail, sem POST de sucesso fictício.

Habilitar somente `user.deleteUser.enabled` no Better Auth não implementa essas funcionalidades. Esta entrega mantém a configuração existente e não inicia essa etapa de desenvolvimento.

## Validação executada nesta entrega

| Verificação | Resultado |
| --- | --- |
| `npm run lint` | Passou. |
| `npm exec -- tsc --noEmit` | Passou. |
| `npm test` | 92 arquivos e 1.374 testes passaram, incluindo acesso às páginas sem sessão/configuração de banco e links em ambos os rodapés. |
| `pnpm test:integration`, no container local | 18 arquivos e 399 testes passaram. Bancos temporários locais; Meta e Resend simulados. O teste de `/delete-user` confirmou resposta 404, conta preservada e sessão ainda válida, coerente com a ausência de exclusão automática. |
| `pnpm build`, no container local | Passou com o banco apontado para um endereço local inacessível. As três novas rotas foram classificadas pelo Next.js como estáticas (`○`). |
| Chromium, 1440 px e 390 px | As três rotas responderam HTTP 200 no build de produção local, sem login, sem banco disponível e também com cookie inválido. Contato, links, navegação, metadados, layout sem rolagem horizontal e ausência de chamadas de autenticação/escrita passaram. Nenhum link `mailto` foi acionado para envio. |

As URLs canônicas usam HTTPS. O teste de navegador foi feito no servidor local; o domínio, o certificado TLS e a disponibilidade dessas rotas na Vercel dependem da publicação manual e não foram alterados nem verificados em produção. Não houve commit, deploy, envio de e-mail, conta real de teste ou exclusão de dados reais.

## Arquivos desta etapa

- `src/app/(app)/privacidade/page.tsx`, `src/app/(app)/termos-de-uso/page.tsx` e `src/app/(app)/exclusao-de-dados/page.tsx`: conteúdo público, metadados e contato real.
- `src/features/legal/components/legal-document.tsx` e `legal-pages.test.tsx`: estrutura visual compartilhada e testes das páginas.
- `src/components/layout/legal-links.tsx`, `legal-links.test.tsx`, `app-shell.tsx` e `src/app/s/layout.tsx`: navegação nos rodapés da aplicação e de compartilhamentos.
- `src/lib/site.ts`: nome e e-mail públicos do responsável.
- `tests/integration/auth.test.ts`: verificação de que o encerramento automático continua desabilitado.
- `README.md` e este relatório: operação, configurações Meta, lacunas e validação.

As alterações de Facebook Login que já estavam na árvore de trabalho antes desta etapa foram preservadas. Não foram reimplementadas nem publicadas automaticamente.

## Referências verificadas

- [LGPD, em especial arts. 5, 9, 11, 16, 18, 19 e 46](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).
- [ANPD: direitos dos titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares).
- [Better Auth: exclusão de usuário e verificações](https://better-auth.com/docs/concepts/users-accounts).
- [Meta: configurações básicas e páginas públicas](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings).
- [Meta: callback de exclusão e seu contrato](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback).

As referências orientam a descrição dos recursos e dos direitos. Não representam certificação de conformidade, aprovação da Meta ou validação de configurações de produção não inspecionadas.
