import "server-only";

import { SITE_NAME } from "@/lib/site";

import { getEmailDeliveryConfig } from "./sign-up-policy";

/** A chamada é aguardada: funções da Vercel não podem abandonar o envio após a resposta. */
export async function sendVerificationEmail({ to, url }: { to: string; url: string }): Promise<void> {
  const config = getEmailDeliveryConfig(process.env);
  if (!config) throw new Error("Envio de e-mail não configurado.");

  // Também cobre confirmações reenviadas por uma tentativa de login sem callback.
  const verificationURL = new URL(url);
  verificationURL.searchParams.set("callbackURL", "/entrar?email=confirmado");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: `${SITE_NAME} <${config.AUTH_EMAIL_FROM}>`,
        to: [to],
        subject: `Confirme seu e-mail — ${SITE_NAME}`,
        text: `Confirme seu e-mail para acessar o ${SITE_NAME}:\n\n${verificationURL.href}\n\nEste link é válido por 1 hora. Se você não solicitou esta conta, ignore esta mensagem.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Falha no envio.");
  } catch {
    // Não expor chave, destinatário, token, URL nem a resposta do provedor nos logs.
    throw new Error("Não foi possível enviar o e-mail de confirmação.");
  }
}
