import { z } from "zod";

import { collectFieldErrors } from "@/lib/utils/collect-field-errors";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const email = z.email("Informe um e-mail válido.").max(254, "Informe um e-mail válido.");

const signInSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha."),
});

const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Informe seu nome.").max(100, "Use no máximo 100 caracteres."),
    email,
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      .max(MAX_PASSWORD_LENGTH, `A senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`),
    confirmation: z.string(),
  })
  .refine((values) => values.password === values.confirmation, {
    path: ["confirmation"],
    error: "As senhas não coincidem.",
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;

export type SignInErrors = Partial<Record<keyof SignInValues, string>>;
export type SignUpErrors = Partial<Record<keyof SignUpValues, string>>;

export type FormResult<Values, Errors> =
  | { success: true; data: Values }
  | { success: false; errors: Errors };

export function parseSignIn(values: SignInValues): FormResult<SignInValues, SignInErrors> {
  const result = signInSchema.safeParse(values);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: collectFieldErrors(result.error.issues, ["email", "password"]) };
}

export function parseSignUp(values: SignUpValues): FormResult<SignUpValues, SignUpErrors> {
  const result = signUpSchema.safeParse(values);
  return result.success
    ? { success: true, data: result.data }
    : {
        success: false,
        errors: collectFieldErrors(result.error.issues, [
          "name",
          "email",
          "password",
          "confirmation",
        ]),
      };
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  USER_ALREADY_EXISTS: "Não foi possível criar a conta com este e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Não foi possível criar a conta com este e-mail.",
  EMAIL_PASSWORD_SIGN_UP_DISABLED: "Novos cadastros estão desativados.",
  PASSWORD_TOO_SHORT: "A senha é curta demais.",
  PASSWORD_TOO_LONG: "A senha é longa demais.",
  INVALID_EMAIL: "Informe um e-mail válido.",
};

const GENERIC_AUTH_ERROR = "Não foi possível concluir agora. Tente novamente.";

/** Mensagem em português. Códigos desconhecidos nunca expõem o texto original do servidor. */
export function getAuthErrorMessage(code: string | undefined): string {
  return (code && AUTH_ERROR_MESSAGES[code]) || GENERIC_AUTH_ERROR;
}
