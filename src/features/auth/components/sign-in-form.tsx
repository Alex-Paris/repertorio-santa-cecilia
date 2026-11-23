"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormError } from "@/components/layout/form-error";
import { FormField, getFieldA11yProps } from "@/components/layout/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { accountLibrary } from "@/features/library/data/browser-library";

import { authClient } from "../auth-client";
import {
  getAuthErrorMessage, getFacebookAuthErrorMessage, parseSignIn, parseVerificationEmail, VERIFICATION_CALLBACK_URL, type SignInErrors,
} from "../services/auth-form";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<SignInErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const awaitingVerification = searchParams.get("cadastro") === "verificar";
  const verificationError = ["TOKEN_EXPIRED", "INVALID_TOKEN", "token_expired", "invalid_token"].includes(searchParams.get("error") ?? "");
  const facebookError = searchParams.get("social") === "facebook" ? searchParams.get("error") : null;
  const facebookNeedsVerification = facebookError === "email_not_verified";

  async function resendVerification(): Promise<void> {
    if (submitting || resending) return;
    const parsed = parseVerificationEmail(email);
    if (!parsed.success) {
      setErrors({ email: "Informe um e-mail válido." });
      return;
    }
    setErrors({});
    setFormError(null);
    setVerificationSent(false);
    setResending(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email: parsed.data, callbackURL: VERIFICATION_CALLBACK_URL,
      });
      if (error) {
        setFormError(getAuthErrorMessage(error.status === 429 ? "TOO_MANY_REQUESTS" : error.code));
        return;
      }
      setVerificationSent(true);
    } catch {
      setFormError(getAuthErrorMessage(undefined));
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting || resending) return;
    setFormError(null);
    setVerificationSent(false);

    const parsed = parseSignIn({ email, password });
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const { error } = await authClient.signIn.email(parsed.data);
      if (error) {
        setNeedsVerification(error.code === "EMAIL_NOT_VERIFIED");
        setFormError(getAuthErrorMessage(error.status === 429 ? "TOO_MANY_REQUESTS" : error.code));
        return;
      }
      // O Next preserva o estado de telas visitadas: a senha não pode ficar na memória.
      setPassword("");
      void accountLibrary.checkSession();
      router.replace("/");
      router.refresh();
    } catch {
      setFormError(getAuthErrorMessage(undefined));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={submitting || resending} className="w-full max-w-sm space-y-5">
      {awaitingVerification && (
        <p role="status" className="text-sm text-muted-foreground">
          Confira seu e-mail para concluir o cadastro. Se já possui uma conta, entre com sua senha.
        </p>
      )}
      {searchParams.get("email") === "confirmado" && !verificationError && (
        <p role="status" className="text-sm text-muted-foreground">E-mail confirmado. Entre para acessar sua conta.</p>
      )}
      {verificationError && <FormError message="O link de confirmação é inválido ou expirou. Informe seu e-mail e solicite outro link." />}
      {facebookError && <FormError message={getFacebookAuthErrorMessage(facebookError)} />}
      <FormField id="signin-email" label="E-mail" error={errors.email}>
        <Input
          {...getFieldA11yProps("signin-email", errors.email)}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-10"
        />
      </FormField>

      <FormField id="signin-password" label="Senha" error={errors.password}>
        <Input
          {...getFieldA11yProps("signin-password", errors.password)}
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-10"
        />
      </FormField>

      {formError && <FormError message={formError} />}
      {verificationSent && (
        <p role="status" className="text-sm text-muted-foreground">
          Se houver uma conta aguardando confirmação, enviaremos um novo link. Confira também a caixa de spam.
        </p>
      )}

      <Button type="submit" size="lg" disabled={submitting || resending} className="h-10 px-4">
        {submitting ? "Entrando…" : "Entrar"}
      </Button>

      {(awaitingVerification || verificationError || needsVerification || facebookNeedsVerification) && (
        <Button type="button" variant="outline" disabled={submitting || resending} onClick={() => void resendVerification()}>
          {resending ? "Reenviando…" : "Reenviar confirmação"}
        </Button>
      )}

      <p className="text-sm text-muted-foreground">
        Ainda não tem uma conta?{" "}
        <Link href="/cadastro" className="text-foreground underline underline-offset-3">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
