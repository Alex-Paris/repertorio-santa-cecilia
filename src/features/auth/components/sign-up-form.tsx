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
import {
  getAuthErrorMessage,
  parseSignUp,
  type SignUpErrors,
  type SignUpValues,
} from "../services/auth-form";

const EMPTY_VALUES: SignUpValues = { name: "", email: "", password: "", confirmation: "" };

export function SignUpForm() {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField(field: keyof SignUpValues, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const parsed = parseSignUp(values);
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const { name, email, password } = parsed.data;
      const { error } = await authClient.signUp.email({ name, email, password });
      if (error) {
        setFormError(getAuthErrorMessage(error.code));
        return;
      }
      setValues(EMPTY_VALUES);
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
      <FormField id="signup-name" label="Nome" error={errors.name}>
        <Input
          {...getFieldA11yProps("signup-name", errors.name)}
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={(event) => setField("name", event.target.value)}
          className="h-10"
        />
      </FormField>

      <FormField id="signup-email" label="E-mail" error={errors.email}>
        <Input
          {...getFieldA11yProps("signup-email", errors.email)}
          type="email"
          name="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => setField("email", event.target.value)}
          className="h-10"
        />
      </FormField>

      <FormField
        id="signup-password"
        label="Senha"
        error={errors.password}
        hint="Use pelo menos 8 caracteres."
      >
        <Input
          {...getFieldA11yProps("signup-password", errors.password)}
          type="password"
          name="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => setField("password", event.target.value)}
          className="h-10"
        />
      </FormField>

      <FormField id="signup-confirmation" label="Confirmar senha" error={errors.confirmation}>
        <Input
          {...getFieldA11yProps("signup-confirmation", errors.confirmation)}
          type="password"
          name="confirmation"
          autoComplete="new-password"
          value={values.confirmation}
          onChange={(event) => setField("confirmation", event.target.value)}
          className="h-10"
        />
      </FormField>

      {formError && <FormError message={formError} />}

      <Button type="submit" size="lg" disabled={submitting} className="h-10 px-4">
        {submitting ? "Criando…" : "Criar conta"}
      </Button>

      <p className="text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-foreground underline underline-offset-3">
          Entrar
        </Link>
      </p>
    </form>
  );
}
