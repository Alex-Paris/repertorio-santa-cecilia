import "server-only";

import { z } from "zod";

import { isSignUpEnabled, requiresEmailVerification } from "./sign-up-policy";

const facebookConfigSchema = z.object({
  FACEBOOK_CLIENT_ID: z.string().trim().regex(/^\d+$/),
  FACEBOOK_CLIENT_SECRET: z.string().trim().min(1),
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
});

/** Configuração parcial mantém o Facebook indisponível sem afetar o login por senha. */
export function getFacebookConfig(source: Record<string, string | undefined>) {
  const parsed = facebookConfigSchema.safeParse(source);
  if (!parsed.success) return null;
  if (source.NODE_ENV === "production" && !parsed.data.BETTER_AUTH_URL.startsWith("https://")) return null;

  return {
    clientId: parsed.data.FACEBOOK_CLIENT_ID,
    clientSecret: parsed.data.FACEBOOK_CLIENT_SECRET,
    scope: ["email", "public_profile"],
    disableDefaultScope: true,
    disableSignUp: !isSignUpEnabled(source),
    requireEmailVerification: requiresEmailVerification(source),
  };
}
