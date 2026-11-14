"use client";

import { cn } from "cn";
import { CloudOff, Library as LibraryIcon, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { FormError } from "@/components/layout/form-error";
import { FormField, getFieldA11yProps } from "@/components/layout/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/features/auth/auth-client";
import { getAuthErrorMessage } from "@/features/auth/services/auth-form";

import { accountLibrary } from "../data/browser-library";
import type { DraftHold, RemoteErrorReason } from "../data/account-library";

const DESCRIPTIONS: Record<Exclude<RemoteErrorReason, "session-expired">, string> = {
  unavailable:
    "Não foi possível carregar sua biblioteca. Isso não significa que ela esteja vazia, e nada foi alterado.",
  "invalid-response":
    "O servidor enviou dados que não puderam ser interpretados. Nada foi alterado.",
};

/** Sem sessão não há biblioteca para mostrar: nada de exemplos nem de dados anteriores. */
export function SignedOutLibrary() {
  return (
    <EmptyState
      icon={LibraryIcon}
      title="Entre para acessar sua biblioteca"
      description="Suas músicas e repertórios ficam salvos na sua conta, disponíveis em qualquer navegador."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/entrar" className={cn(buttonVariants({ size: "lg" }))}>
            Entrar
          </Link>
          <Link href="/cadastro" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Criar conta
          </Link>
          <Link href="/catalogo" className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}>
            Explorar o catálogo
          </Link>
        </div>
      }
    />
  );
}

/** Em uma falha remota nunca há lista vazia: "indisponível" não é o mesmo que "sem músicas". */
export function RemoteLibraryError({ reason }: { reason: RemoteErrorReason }) {
  if (reason === "session-expired") {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Sua sessão expirou"
        description="Entre novamente para acessar sua biblioteca. Nenhuma alteração será enviada sem uma sessão válida."
        action={
          <Link href="/entrar" className={cn(buttonVariants({ size: "lg" }))}>
            Entrar
          </Link>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={CloudOff}
      title="Biblioteca indisponível"
      description={DESCRIPTIONS[reason]}
      action={
        <Button size="lg" onClick={() => void accountLibrary.retry()}>
          Tentar novamente
        </Button>
      }
    />
  );
}

export function StaleLibraryNotice() {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm">
      <p>Não foi possível atualizar. Estes são os últimos dados carregados.</p>
      <Button variant="outline" size="sm" onClick={() => void accountLibrary.retry()}>
        Tentar novamente
      </Button>
    </div>
  );
}

/** Sessão perdida com texto não salvo: entrar de novo, sem sair da tela, permite salvar. */
export function DraftHoldNotice({ hold }: { hold: DraftHold }) {
  const [email, setEmail] = useState(hold.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(getAuthErrorMessage(signInError.code));
        return;
      }
      setPassword("");
      await accountLibrary.checkSession();
    } catch {
      setError(getAuthErrorMessage(undefined));
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      role="alert"
      className="sticky top-14 z-10 mb-6 space-y-3 rounded-lg border border-destructive/40 bg-background p-3 text-sm"
    >
      <p className="flex items-start gap-2 font-medium">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        Sua sessão expirou. Nada foi salvo.
      </p>
      <p className="text-muted-foreground">
        Seu texto continua nesta tela, somente na memória desta aba. Se você fechar ou atualizar a
        aba, ele será perdido. Entre novamente com a mesma conta para salvar.
      </p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <FormField id="draft-email" label="E-mail">
            <Input
              {...getFieldA11yProps("draft-email", undefined)}
              type="email"
              autoComplete="username"
              // A mesma conta é a única que pode retomar este rascunho.
              readOnly={Boolean(hold.email)}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10"
            />
          </FormField>
        </div>
        <div className="min-w-48 flex-1">
          <FormField id="draft-password" label="Senha">
            <Input
              {...getFieldA11yProps("draft-password", undefined)}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10"
            />
          </FormField>
        </div>
        <Button type="submit" size="lg" className="h-10 px-4" disabled={pending}>
          {pending ? "Entrando…" : "Entrar novamente"}
        </Button>
      </form>
      {error && <FormError message={error} />}
    </section>
  );
}
