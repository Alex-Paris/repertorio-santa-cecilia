import Link from "next/link";

import { LegalContact, LegalDocument, LegalSection, legalMetadata } from "@/features/legal/components/legal-document";
import { SITE_PRIVACY_EMAIL } from "@/lib/site";

export const metadata = legalMetadata(
  "Exclusão de conta e dados",
  "Como solicitar acesso, eliminação de dados e encerramento da conta no Repertório Santa Cecília, inclusive para login com Facebook.",
  "/exclusao-de-dados",
);

export default function DataDeletionPage() {
  return (
    <LegalDocument title="Exclusão de conta e dados" description="Um canal de atendimento para solicitar a eliminação dos seus dados e da sua conta.">
      <LegalSection id="como-solicitar" title="1. Como solicitar">
        <p>O atendimento de exclusão é manual. Não existe botão de eliminação automática da conta nesta versão. Você pode solicitar o encerramento integral da conta ou a análise de dados específicos, mesmo sem conseguir fazer login.</p>
        <LegalContact subject="Exclusão de conta e dados" />
        <ol className="list-decimal space-y-2 pl-5">
          <li>Envie uma mensagem para <a href={`mailto:${SITE_PRIVACY_EMAIL}`}>{SITE_PRIVACY_EMAIL}</a>, preferencialmente a partir do e-mail cadastrado na conta.</li>
          <li>Use o assunto “Exclusão de conta e dados — Repertório Santa Cecília”. Informe o nome e o e-mail da conta, se o acesso era por Facebook ou por senha e se deseja encerrar a conta inteira ou tratar dados específicos.</li>
          <li>Se o pedido envolver um link público, crédito no catálogo ou contribuição, informe o endereço ou a identificação do conteúdo para facilitar sua localização.</li>
          <li>O responsável confirmará a titularidade e o escopo antes de executar a eliminação. Se você não tiver acesso ao e-mail cadastrado, informe essa situação para combinar uma verificação proporcional e segura.</li>
        </ol>
        <p>Não envie senha, token do Facebook, código de verificação ou documentos pessoais sem solicitação justificada. O pedido não tem custo. Abrir esta página não envia uma solicitação nem apaga dados.</p>
      </LegalSection>

      <LegalSection id="atendimento" title="2. O que acontece no atendimento">
        <p>O responsável recebe a mensagem, verifica a identidade e identifica os registros vinculados à conta. A execução é feita por uma pessoa autorizada à operação do serviço, com atenção à biblioteca, às sessões, aos compartilhamentos e aos conteúdos editoriais relacionados.</p>
        <p>Após a análise, você deve receber uma resposta informando o que foi eliminado, anonimizado ou mantido, eventual motivo legal de conservação e as limitações existentes. Se for necessária alguma informação adicional, o responsável solicitará apenas o necessário. Não há protocolo eletrônico ou acompanhamento automático de pedidos no site.</p>
        <p>Não há prazo técnico automático de eliminação configurado. O responsável deve informar o prazo aplicável ao pedido e observar as obrigações legais. O prazo de até quinze dias previsto na LGPD para uma declaração completa de confirmação ou acesso a dados não significa que todo pedido de exclusão seja automaticamente concluído nesse período.</p>
      </LegalSection>

      <LegalSection id="escopo" title="3. Dados e conteúdos abrangidos">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Conta e acesso:</strong> identificação, dados de login, vínculo com o Facebook, tokens de acesso e sessões vinculadas, para encerrar o acesso à conta eliminada.</li>
          <li><strong>Biblioteca privada:</strong> músicas, cifras, repertórios, anotações, datas e registros auxiliares de importação e edição vinculados à conta.</li>
          <li><strong>Links públicos:</strong> revogação dos compartilhamentos da conta e remoção das cópias publicadas que eles mantêm no serviço.</li>
          <li><strong>Contribuições e catálogo:</strong> análise das propostas, créditos públicos, referências de vídeo e dados pessoais nos históricos. Uma música publicada pode envolver direitos e conteúdo de terceiros; o tratamento dos dados pessoais e a análise da permanência da obra são feitos separadamente e devem ser explicados na resposta.</li>
          <li><strong>Registros operacionais:</strong> avaliação de logs, registros de atendimento, backups e eventual conservação obrigatória. Qualquer retenção deve ser delimitada e justificada, sem conservar dados indefinidamente apenas por conveniência.</li>
        </ul>
        <p>Os recursos atuais não fazem essa limpeza integral de maneira automática. Eliminar somente o cadastro de autenticação não garante a remoção da biblioteca, dos links ou das contribuições. Por isso, o responsável deve verificar todo o escopo no atendimento manual.</p>
      </LegalSection>

      <LegalSection id="facebook" title="4. Se sua conta usa Facebook Login">
        <p>Informe no pedido que você utilizava o Facebook e o e-mail exibido na sua conta do Santa Cecília. Não precisamos da sua senha do Facebook. O pedido é para os dados mantidos pelo Santa Cecília, não para eliminar sua conta pessoal na Meta.</p>
        <p>Você também pode remover a autorização do aplicativo na área de aplicativos e sites das configurações do Facebook. Essa ação controla a permissão concedida à Meta, mas não elimina automaticamente os registros já mantidos aqui. Para solicitar a eliminação no Santa Cecília, use o canal de e-mail desta página.</p>
        <p>Esta é uma página pública de instruções. Ela não é um endpoint automático de exclusão da Meta e não confirma uma eliminação apenas por receber uma visita.</p>
      </LegalSection>

      <LegalSection id="antes" title="5. Cópias e ações que você pode realizar">
        <p>Se quiser conservar sua biblioteca, use “Exportar backup” antes de pedir sua eliminação. Você também pode revogar seus links na área <Link href="/compartilhamentos">Compartilhamentos</Link> e retirar sugestões ainda elegíveis em <Link href="/conta/sugestoes">Minhas sugestões</Link>. Essas áreas exigem login; o pedido por e-mail continua disponível sem login.</p>
        <p>Arquivos exportados, impressões, capturas e cópias que outras pessoas fizeram não são apagados pelo site. Preferências e a biblioteca antiga armazenada no navegador também precisam ser removidas no próprio dispositivo, pelos recursos disponíveis ou nas configurações do navegador.</p>
        <p>Para outros pedidos, como acesso ou correção, use o mesmo canal e indique o direito que deseja exercer. Veja também a <Link href="/privacidade">Política de Privacidade</Link> e os <Link href="/termos-de-uso">Termos de Uso</Link>.</p>
      </LegalSection>
    </LegalDocument>
  );
}
