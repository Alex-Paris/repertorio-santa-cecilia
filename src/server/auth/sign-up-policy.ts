import { z } from "zod";

const emailDeliverySchema = z.object({
  RESEND_API_KEY: z.string().trim().min(1),
  AUTH_EMAIL_FROM: z.email(),
});

type SignUpEnvironment = Record<string, string | undefined>;

export function getEmailDeliveryConfig(source: SignUpEnvironment) {
  const result = emailDeliverySchema.safeParse(source);
  return result.success ? result.data : null;
}

export function requiresEmailVerification(source: SignUpEnvironment): boolean {
  // Fechar novos cadastros nunca libera o login de contas ainda não confirmadas.
  return source.NODE_ENV === "production" || source.AUTH_ALLOW_SIGNUP === "true";
}

/**
 * O cadastro público exige envio real de e-mail; a exceção de desenvolvimento
 * continua restrita a development/test e nunca abre o cadastro em produção.
 */
export function isSignUpEnabled(source: SignUpEnvironment): boolean {
  const { NODE_ENV: nodeEnv } = source;
  if (!["development", "test", "production"].includes(nodeEnv ?? "")) return false;

  if (source.AUTH_ALLOW_SIGNUP === "true") {
    if (!getEmailDeliveryConfig(source)) return false;
    return nodeEnv !== "production" || source.BETTER_AUTH_URL?.startsWith("https://") === true;
  }

  return nodeEnv !== "production" && source.AUTH_ALLOW_DEV_SIGNUP === "true";
}
