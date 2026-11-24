"use client";

import { useState } from "react";

import { FacebookIcon } from "@/components/brand/facebook-icon";
import { FormError } from "@/components/layout/form-error";
import { Button } from "@/components/ui/button";

import { authClient } from "../auth-client";
import { FACEBOOK_ERROR_CALLBACK_URL } from "../services/auth-form";

export function FacebookAuthButton() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(): Promise<void> {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await authClient.signIn.social({
        provider: "facebook",
        callbackURL: "/",
        newUserCallbackURL: "/",
        errorCallbackURL: FACEBOOK_ERROR_CALLBACK_URL,
      });
      if (result.error) {
        const messages: Record<number, string> = {
          429: "Muitas tentativas. Aguarde um minuto e tente novamente.",
          503: "O serviço de contas está indisponível no momento. Tente novamente mais tarde.",
        };
        setError(messages[result.error.status] ?? "Não foi possível acessar o Facebook agora. Tente novamente.");
        setSubmitting(false);
      }
      // O Better Auth conduz o redirecionamento para o Facebook.
    } catch {
      setError("Não foi possível acessar o Facebook agora. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full gap-3"
        disabled={submitting}
        aria-busy={submitting}
        onClick={() => void handleSignIn()}
      >
        <FacebookIcon />
        {submitting ? "Abrindo Facebook…" : "Continuar com Facebook"}
      </Button>
      {error && <FormError message={error} />}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden />
        <span>ou use seu e-mail</span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
    </div>
  );
}
