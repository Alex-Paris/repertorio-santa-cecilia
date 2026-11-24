import Link from "next/link";

import { LegalContact, LegalDocument, LegalSection, legalMetadata } from "@/features/legal/components/legal-document";
import { SITE_NAME } from "@/lib/site";

export const metadata = legalMetadata(
  "Política de Privacidade",
  "Dados pessoais, autenticação, biblioteca, compartilhamentos e direitos de privacidade no Repertório Santa Cecília.",
  "/privacidade",
);

export default function PrivacyPage() {
  return (
    <LegalDocument title="Política de Privacidade" description="Como seus dados são usados no Santa Cecília e como exercer seus direitos." updatedAt="2026-11-24">
      <LegalSection id="responsavel" title="1. Responsável e contato">
        <p>Esta política descreve o tratamento de dados no {SITE_NAME}, um serviço de organização musical para missas e encontros. Você pode ler estas informações e solicitar atendimento sem estar conectado a uma conta.</p>
        <LegalContact subject="Solicitação de privacidade" />
      </LegalSection>

      <LegalSection id="dados" title="2. Dados que utilizamos">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Conta:</strong> nome, e-mail, identificador interno, situação de confirmação do e-mail e datas de criação e atualização. No cadastro por senha, recebemos a senha para autenticar você e guardamos apenas sua representação protegida por hash, nunca a senha em texto aberto.</li>
          <li><strong>Login com Facebook:</strong> identificador da conta no aplicativo da Meta, nome, e-mail quando fornecido e endereço da imagem de perfil quando disponível. Também são registrados a associação do provedor à conta, permissões concedidas e tokens necessários ao acesso. O site não recebe sua senha do Facebook.</li>
          <li><strong>Acesso e segurança:</strong> identificadores e validade das sessões, informações do navegador, endereço IP quando disponibilizado pela infraestrutura e contadores de tentativas. A hospedagem também pode manter registros técnicos das requisições.</li>
          <li><strong>Biblioteca pessoal:</strong> títulos, artistas ou autores informados, tons, cifras, links de fontes, repertórios, ordem das músicas, transposições, anotações, descrições, celebrações e datas que você cadastrar, além de registros de importação e de edição.</li>
          <li><strong>Contribuições:</strong> cópias das músicas enviadas para avaliação, mensagens, referências de vídeo, declarações de direitos, permissões de uso, preferência de crédito público, versões e histórico das decisões. A administração pode consultar o nome e o e-mail da conta para analisar uma contribuição.</li>
          <li><strong>Atendimento:</strong> nome, e-mail, conteúdo e informações mínimas necessárias para verificar e atender pedidos enviados ao canal de contato. Esses pedidos são tratados por e-mail; não há formulário ou protocolo automático de atendimento no site.</li>
        </ul>
        <p>Não há campo específico para informar sua religião. Ainda assim, repertórios e textos associados a uma pessoa podem revelar contexto ou convicção religiosa. Evite inserir dados sensíveis ou dados pessoais de terceiros sem necessidade e autorização adequada. Dados sensíveis exigem as condições específicas previstas na LGPD; usar o site ou aceitar termos não constitui consentimento genérico para qualquer tratamento.</p>
      </LegalSection>

      <LegalSection id="finalidades" title="3. Finalidades e autenticação">
        <p>Usamos os dados para disponibilizar a conta e a biblioteca solicitadas por você, organizar repertórios, confirmar e-mails, manter sessões, prevenir acessos indevidos, avaliar contribuições, publicar o conteúdo que você decidir compartilhar e atender solicitações de direitos. Registros de direitos autorais e de revisão apoiam a análise de permissões e a rastreabilidade editorial.</p>
        <p>O Better Auth é a biblioteca de autenticação executada no servidor do Santa Cecília. Ela administra contas, hashes de senha, sessões, verificações e o fluxo de login externo. Os registros ficam no banco configurado para o serviço; o Better Auth não é um cadastro público separado e a telemetria da biblioteca está desativada nesta aplicação.</p>
        <p>O tratamento deve se limitar às finalidades informadas e à base legal aplicável a cada operação, observando necessidade, segurança e os direitos do titular. Se uma finalidade depender de consentimento, ele deve ser específico e passível de revogação. Uma autorização para divulgar uma cifra não equivale a autorização irrestrita para divulgar dados pessoais.</p>
      </LegalSection>

      <LegalSection id="facebook" title="4. Como funciona o Facebook Login">
        <p>Quando você escolhe “Continuar com Facebook”, seu navegador vai para a Meta para autenticar e autorizar o acesso. Solicitamos apenas as permissões de perfil público e e-mail. O Santa Cecília não solicita acesso a publicações, lista de amigos ou mensagens e não publica conteúdo na sua conta do Facebook.</p>
        <p>Se o Facebook não fornecer um e-mail, o acesso é recusado com orientação para autorizar seu compartilhamento ou usar o cadastro por e-mail. Em produção, quando o e-mail recebido não estiver verificado, enviamos uma confirmação antes de abrir uma sessão. Contas existentes com e-mail coincidente não são associadas automaticamente ao Facebook.</p>
        <p>A Meta processa o login segundo suas próprias políticas. As músicas, anotações e repertórios da sua biblioteca não são enviados ao Facebook por esse fluxo. Remover a autorização na Meta não elimina automaticamente a conta ou os dados mantidos no Santa Cecília; veja <Link href="/exclusao-de-dados">como solicitar a exclusão</Link>.</p>
      </LegalSection>

      <LegalSection id="biblioteca" title="5. Armazenamento e prestadores de serviço">
        <p>As contas, músicas e repertórios são armazenados no MongoDB Atlas configurado pelo responsável. A biblioteca é vinculada ao identificador da conta, e as operações privadas verificam a sessão e a titularidade dos registros. Ela não é apresentada a outros usuários como uma biblioteca pública.</p>
        <p>A Vercel hospeda a aplicação e processa suas requisições. O MongoDB Atlas armazena os registros. O Resend recebe o endereço do destinatário e o conteúdo necessário aos e-mails de confirmação. A Meta participa somente quando você usa Facebook Login. O acesso operacional aos dados deve ficar limitado às pessoas e aos prestadores que dele necessitam para manter o serviço, atender solicitações ou cumprir obrigação aplicável.</p>
        <p>Região dos servidores, eventuais transferências internacionais e ciclos de logs e backups dependem das configurações e dos contratos desses provedores. Esses detalhes não são determinados por estas páginas e podem ser solicitados ao responsável. Não presumimos que os dados permaneçam exclusivamente no Brasil.</p>
      </LegalSection>

      <LegalSection id="publicacao" title="6. O que pode ficar público">
        <p>Um repertório só ganha um link público mediante uma ação de compartilhamento. Quem obtiver esse link poderá ler a cópia publicada, sem login, e repassá-la. O conteúdo pode incluir nome e descrição do repertório, título da celebração, músicas, artistas, tons, ordem e momentos litúrgicos. A data da celebração só é incluída quando você escolhe publicá-la. Cifras e links seguem as permissões de conteúdo aplicáveis.</p>
        <p>O link público não inclui automaticamente seu e-mail, identificador de conta, anotações dos itens ou dados de sessão. Porém, informações pessoais que você escrever no nome, na descrição ou no próprio conteúdo podem ser expostas. Confira a prévia antes de publicar.</p>
        <p>Você pode revogar os links na área de compartilhamentos. A revogação impede novas leituras pelo link e remove a cópia publicada dos registros de compartilhamento. Ela não recolhe impressões, arquivos, capturas ou cópias que outras pessoas já tenham feito.</p>
        <p>O catálogo central é público e passa por revisão editorial. Contribuições podem gerar uma cópia independente no catálogo; o crédito público é opcional e depende da preferência informada no envio. Excluir uma música da biblioteca pessoal não remove automaticamente uma contribuição ou sua publicação no catálogo.</p>
      </LegalSection>

      <LegalSection id="cookies" title="7. Cookies, preferências e serviços externos">
        <p>Na administração, buscar uma liturgia por data consulta a API independente Liturgia Diária. O servidor envia somente a data escolhida; não envia nome, e-mail, cookies, sessão ou biblioteca da conta. O provedor pode receber dados técnicos da conexão do servidor. A consulta fornece metadados e referências para conferência, sem salvar ou aprovar uma celebração automaticamente.</p>
        <p>Cookies de autenticação mantêm a sessão e protegem etapas do login. Em produção, os cookies de sessão usam proteção HttpOnly, Secure e SameSite=Lax. A validade padrão da sessão é de sete dias e pode ser renovada durante o uso; sair da conta invalida a sessão correspondente no servidor. Bloquear esses cookies pode impedir o acesso às áreas privadas.</p>
        <p>Seu navegador também pode guardar tema, preferências de leitura e, em instalações antigas, uma biblioteca local ainda não importada. Sair da conta ou solicitar a exclusão no servidor não limpa automaticamente esses dados, backups exportados ou arquivos no seu dispositivo. A biblioteca antiga pode ser removida pela opção específica de importação, e preferências podem ser apagadas nas configurações do navegador.</p>
        <p>Não há scripts de publicidade comportamental ou de análise de audiência incluídos na aplicação atual. Referências de vídeo do YouTube são carregadas somente quando você pede, usando o domínio de privacidade aprimorada do YouTube. Ao carregar um vídeo ou abrir um link externo, o terceiro pode receber dados técnicos, como seu IP, e aplicar sua própria política e seus próprios cookies.</p>
      </LegalSection>

      <LegalSection id="retencao" title="8. Retenção e segurança">
        <p>Músicas e repertórios permanecem vinculados à conta até sua remoção pelos recursos disponíveis ou pelo atendimento de um pedido de eliminação. Não há exclusão automática da conta por inatividade. Sessões e verificações têm validade, mas a expiração não significa necessariamente que todo registro técnico seja removido imediatamente.</p>
        <p>O código usa hash de senha, verificações de origem, autorização por conta, limites de tentativas e criptografia dos tokens de acesso OAuth no banco. A área administrativa exige uma permissão concedida separadamente; criar uma conta, inclusive com Facebook, não concede acesso administrativo. A proteção da infraestrutura, dos acessos operacionais e dos backups também depende da administração do serviço.</p>
        <p>Não há rotina de expurgo integral e automático de todos os dados e backups ao solicitar exclusão. O atendimento é manual. Se alguma informação precisar ser conservada por obrigação ou hipótese legal aplicável, o responsável deve informar os dados, a justificativa e o período de conservação. Os prazos operacionais de logs, backups e registros de atendimento ainda precisam ser confirmados pelo responsável; não prometemos sua remoção imediata.</p>
      </LegalSection>

      <LegalSection id="direitos" title="9. Seus direitos e como exercê-los">
        <p>Conforme a LGPD e as condições aplicáveis, você pode solicitar confirmação e acesso aos seus dados; correção; anonimização, bloqueio ou eliminação de dados desnecessários ou tratados irregularmente; portabilidade nos termos da regulamentação; informações sobre compartilhamentos, consentimento e suas consequências; revogação de consentimento e eliminação de dados tratados com essa base, ressalvadas as hipóteses legais de conservação. Também pode solicitar revisão e explicações de decisões unicamente automatizadas que afetem seus interesses, quando houver.</p>
        <p>Use o canal de contato desta página e descreva o pedido. Para proteger sua conta, podemos pedir confirmação de titularidade proporcional ao caso. Não envie senhas, códigos de autenticação ou tokens. O exercício dos direitos é gratuito. Pedidos de confirmação e acesso seguem os prazos da LGPD: resposta simplificada imediata ou declaração completa em até quinze dias. Esse prazo não é uma promessa de exclusão automática de conta.</p>
        <p>O recurso “Exportar backup” permite obter músicas e repertórios da biblioteca, mas não substitui uma solicitação de acesso a todos os dados da conta. Para eliminação, siga a <Link href="/exclusao-de-dados">página de exclusão de dados</Link>. Representantes legais também podem apresentar solicitações, com comprovação adequada da representação.</p>
        <p>Se considerar que seu pedido não foi atendido adequadamente, você pode buscar os canais da <a href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados">ANPD</a>. Consulte a <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm">Lei Geral de Proteção de Dados</a> e as <a href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados/direito-dos-titulares">orientações sobre direitos dos titulares</a>.</p>
      </LegalSection>

      <LegalSection id="atualizacoes" title="10. Atualizações desta política">
        <p>A data no início identifica esta versão. Mudanças relevantes no tratamento devem ser comunicadas pelo responsável e refletidas aqui. Novas finalidades que exijam consentimento específico não podem ser autorizadas apenas por uma alteração deste texto.</p>
      </LegalSection>
    </LegalDocument>
  );
}
