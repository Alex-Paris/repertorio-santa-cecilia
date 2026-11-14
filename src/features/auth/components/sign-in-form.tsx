"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormError } from "@/components/layout/form-error";
import { FormField, getFieldA11yProps } from "@/components/layout/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { accountLibrary } from "@/features/library/data/browser-library";

import { authClient } from "../auth-client";
import { getAuthErrorMessage, parseSignIn, type SignInErrors } from "../services/auth-form";

export function SignInForm({ signUpEnabled }: { signUpEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<SignInErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

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
        setFormError(getAuthErrorMessage(error.code));
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
    <form onSubmit={handleSubmit} noValidate className="max-w-sm space-y-5">
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

      <Button type="submit" size="lg" disabled={submitting} className="h-10 px-4">
        {submitting ? "Entrando…" : "Entrar"}
      </Button>

      {signUpEnabled && (
        <p className="text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="text-foreground underline underline-offset-3">
            Criar conta
          </Link>
        </p>
      )}
    </form>
  );
}
