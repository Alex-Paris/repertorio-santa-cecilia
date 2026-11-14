const NON_PRODUCTION_ENVIRONMENTS = new Set(["development", "test"]);

/**
 * Sem envio real de e-mails, novos cadastros existem apenas fora de produção e com
 * autorização explícita. Nenhuma variável consegue abrir o cadastro em produção.
 */
export function isSignUpEnabled(
  nodeEnv: string | undefined,
  allowDevSignUp: string | undefined,
): boolean {
  return nodeEnv !== undefined && NON_PRODUCTION_ENVIRONMENTS.has(nodeEnv) && allowDevSignUp === "true";
}
