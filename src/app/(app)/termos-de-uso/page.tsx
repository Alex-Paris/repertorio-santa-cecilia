import Link from "next/link";

import { LegalContact, LegalDocument, LegalSection, legalMetadata } from "@/features/legal/components/legal-document";
import { SITE_NAME } from "@/lib/site";

export const metadata = legalMetadata(
  "Termos de Uso",
  "Regras da biblioteca pessoal, contribuições, direitos autorais e compartilhamento no Repertório Santa Cecília.",
  "/termos-de-uso",
);

export default function TermsPage() {
  return (
    <LegalDocument title="Termos de Uso" description="Regras para organizar sua biblioteca, contribuir e compartilhar repertórios.">
      <LegalSection id="servico" title="1. O serviço e seu responsável">
        <p>O {SITE_NAME} permite consultar um catálogo musical, manter uma biblioteca pessoal, preparar repertórios e organizar a música de missas e encontros. Alguns recursos dependem de conta e outros podem ser consultados publicamente.</p>
        <p>As classificações, revisões e sugestões são editoriais do Santa Cecília. Não constituem aprovação oficial da Igreja, de uma diocese ou da CNBB. Verifique a adequação litúrgica com os responsáveis pela celebração; a base de datas e referências pode estar incompleta ou precisar de revisão.</p>
        <LegalContact subject="Contato sobre termos de uso e direitos autorais" />
      </LegalSection>

      <LegalSection id="conta" title="2. Conta e acesso">
        <p>Forneça informações corretas e utilize apenas uma conta e um e-mail sobre os quais tenha autorização. Proteja sua senha, seu e-mail e o acesso ao Facebook. O login com Facebook depende da autorização concedida na Meta e pode exigir confirmação adicional do e-mail.</p>
        <p>Criar uma conta não concede privilégios administrativos. Não tente acessar bibliotecas alheias, assumir a identidade de outra pessoa, contornar limites de segurança ou explorar falhas do serviço. Caso perceba um problema de acesso, comunique o responsável.</p>
        <p>O uso por crianças e adolescentes exige atenção do responsável legal e às proteções aplicáveis. O cadastro atual não verifica idade nem implementa um fluxo específico de consentimento parental. Responsáveis legais podem solicitar orientação ou exercer direitos de dados pelo canal de contato.</p>
      </LegalSection>

      <LegalSection id="biblioteca" title="3. Biblioteca pessoal e cópias">
        <p>A biblioteca fica associada à sua conta. Você pode cadastrar músicas, cifras ou links, criar repertórios, ajustar tons e registrar informações das celebrações pelos recursos disponíveis. Revise o que incluir, especialmente dados pessoais em nomes, descrições e anotações.</p>
        <p>Mantenha uma cópia dos conteúdos importantes usando a exportação de backup. Arquivos baixados, impressões e dados antigos guardados no navegador são cópias sob seu controle. A importação da biblioteca antiga é uma ação explícita e não garante que os dados locais já estejam na conta.</p>
        <p>Apagar uma música, retirar uma sugestão, revogar um compartilhamento e excluir a conta são operações diferentes. Uma cópia enviada como contribuição ou publicada em repertório não é necessariamente removida ao apagar o registro original da biblioteca. Consulte as orientações de cada recurso e, quando necessário, solicite atendimento.</p>
      </LegalSection>

      <LegalSection id="direitos-autorais" title="4. Direitos autorais e fontes">
        <p>Cadastre ou compartilhe conteúdo apenas quando tiver os direitos ou a autorização necessária para esse uso. Indique autoria, fonte e permissões com exatidão. A presença de uma cifra em outro site, seu uso religioso ou uma referência em subsídio litúrgico não autoriza, por si só, sua cópia, exibição ou redistribuição.</p>
        <p>As permissões para exibir uma cifra no site, reproduzi-la e redistribuí-la em links públicos são avaliadas separadamente. Quando não há permissão de conteúdo, o catálogo pode mostrar somente metadados ou uma referência externa. Um link externo ou vídeo não significa que o Santa Cecília seja dono da obra ou controle a disponibilidade do serviço de origem.</p>
        <p>O envio de uma contribuição não transfere automaticamente a autoria ou todos os direitos sobre a obra. O uso do conteúdo depende das declarações e permissões específicas registradas no envio e da análise editorial. Não forneça autorização em nome de quem você não representa.</p>
        <p>Para comunicar violação de direitos, envie o endereço do conteúdo, a identificação da obra, sua relação com o titular e informações suficientes para análise. Não envie documentos ou dados além do necessário. A retirada, restrição ou correção deve ser avaliada pelo responsável conforme o caso e os direitos envolvidos.</p>
      </LegalSection>

      <LegalSection id="contribuicoes" title="5. Contribuições e publicação no catálogo">
        <p>Ao sugerir uma música, o sistema envia uma cópia do conteúdo salvo na sua biblioteca, das declarações de direitos, da classificação sugerida e das informações opcionais que você preencher. A equipe pode aprovar, recusar, pedir ajustes ou identificar uma contribuição como complemento de outra música.</p>
        <p>A publicação exige revisão e permissão adequada. Não há aprovação automática nem garantia de publicação. O crédito público depende da opção escolhida no envio; o e-mail da conta não é publicado automaticamente como crédito.</p>
        <p>Uma sugestão ainda elegível pode ser retirada na área “Minhas sugestões”. A retirada remove o conteúdo de cifra e de link da proposta conforme o recurso atual, mas preserva informações e histórico da solicitação; ela não equivale à eliminação integral de dados pessoais. Uma contribuição já aprovada exige análise da administração para correção, remoção de crédito ou vídeo, despublicação ou outro atendimento.</p>
      </LegalSection>

      <LegalSection id="compartilhamento" title="6. Compartilhamento de repertórios">
        <p>Antes de gerar um link público, confira a prévia e as autorizações de cada conteúdo. O nome, a descrição e os demais campos publicados poderão ser lidos por qualquer pessoa com o endereço. Você deve ter autorização para divulgar dados de terceiros e conteúdo protegido.</p>
        <p>Quem recebe um link pode repassá-lo, imprimir ou copiar o que conseguir visualizar. A revogação impede novos acessos pelo endereço do Santa Cecília, mas não remove cópias que já estejam fora do serviço. A ausência de indexação em mecanismos de busca não substitui um controle de acesso.</p>
        <p>Não publique informações pessoais desnecessárias, credenciais ou dados sensíveis em títulos, descrições, cifras ou outros campos que possam se tornar públicos.</p>
      </LegalSection>

      <LegalSection id="disponibilidade" title="7. Uso adequado e disponibilidade">
        <p>Utilize o serviço de modo lícito e respeitoso. Não envie conteúdo fraudulento, ofensivo, ilegal, malicioso ou que viole direitos de outras pessoas. Não realize tentativas automatizadas de acesso indevido, spam ou ações que prejudiquem a disponibilidade.</p>
        <p>O serviço, os links externos e as referências de vídeo podem sofrer falhas, manutenção ou alterações. Limites de segurança podem recusar temporariamente uma operação. O responsável poderá analisar denúncias e restringir conteúdos ou acessos pelos meios disponíveis, com justificativa cabível e respeito aos direitos do usuário. Estas regras não afastam direitos assegurados pela legislação.</p>
      </LegalSection>

      <LegalSection id="privacidade" title="8. Privacidade, encerramento e contato">
        <p>A <Link href="/privacidade">Política de Privacidade</Link> descreve os dados tratados, cookies, prestadores e direitos do titular. Para solicitar acesso, correção ou exclusão de conta e dados, use o canal informado e siga a <Link href="/exclusao-de-dados">página de exclusão de dados</Link>.</p>
        <p>O encerramento da conta é atendido manualmente; não existe botão de exclusão automática nesta versão. Abrir estas páginas ou preparar um e-mail não apaga dados nem conclui um pedido. Alterações relevantes nestes termos devem ser apresentadas com a data da nova versão e comunicadas quando necessário.</p>
      </LegalSection>
    </LegalDocument>
  );
}
