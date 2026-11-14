"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

import { FormError } from "@/components/layout/form-error";
import { Button } from "@/components/ui/button";

import { accountLibrary } from "@/features/library/data/browser-library";

import { authClient } from "../auth-client";

export function SignOutButton() {
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSignOut(): Promise<void> {
    setFailed(false);
    setPending(true);
    // Antes de sair: nenhuma leitura ou escrita remota continua depois deste ponto.
    accountLibrary.prepareSignOut();
    try {
      const { error } = await authClient.signOut();
      if (error) {
        setFailed(true);
        void accountLibrary.checkSession();
        return;
      }
      // Navegação completa: descarta da memória as telas com dados privados da conta.
      window.location.replace("/entrar");
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button variant="outline" size="lg" className="h-10 px-4" disabled={pending} onClick={handleSignOut}>
        <LogOut data-icon="inline-start" aria-hidden />
        {pending ? "Saindo…" : "Sair da conta"}
      </Button>
      {failed && <FormError message="Não foi possível sair agora. Tente novamente." />}
    </div>
  );
}
