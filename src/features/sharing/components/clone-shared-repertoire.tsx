"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { FormError } from "@/components/layout/form-error";
import { MENU_ITEM_CLASS, MoreActionsMenu } from "@/components/layout/more-actions-menu";
import { authClient } from "@/features/auth/auth-client";
import { withAuthReturn } from "@/features/auth/services/auth-return";
import { createLibraryApi } from "@/features/library/data/remote/library-api";
import { getLibraryErrorMessage } from "@/features/library/domain/library-errors";

import { cloneShareResponseSchema, type CloneShareResult } from "../domain/clone-share";

/** A leitura não carrega sessão nem biblioteca: a conta só é consultada ao pedir uma cópia. */
export function CloneSharedRepertoire({ token, returnHref }: { token: string; returnHref?: string }) {
  const router = useRouter();
  const requestId = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CloneShareResult | null>(null);

  async function copy() {
    if (pending || result) return;
    setPending(true);
    setError(null);
    try {
      const session = await authClient.getSession();
      if (session.error) throw new Error("session-unavailable");
      if (!session.data?.user) {
        router.push(withAuthReturn("/entrar", returnHref ?? `/s/${token}`));
        return;
      }
      requestId.current ??= crypto.randomUUID();
      const api = createLibraryApi({ userId: session.data.user.id });
      setResult(await api.request("/shares/clone", cloneShareResponseSchema, {
        method: "POST", body: { token, requestId: requestId.current },
      }));
    } catch (caught) {
      setError(getLibraryErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {result ? (
        <>
          <p role="status" className="px-3 py-2 text-sm">
            Cópia salva nos seus repertórios. Você pode editar sua cópia de forma independente.
            {result.skippedItems > 0 && ` ${result.skippedItems === 1 ? "Uma música indisponível não foi copiada." : `${result.skippedItems} músicas indisponíveis não foram copiadas.`}`}
          </p>
          {/* Navegação completa atualiza a biblioteca da conta, inclusive se já estava aberta nesta aba. */}
          <a href={`/repertorios/${encodeURIComponent(result.repertoire.id)}`} className={MENU_ITEM_CLASS}><Copy aria-hidden />Abrir meu repertório</a>
        </>
      ) : (
        <>
          <button type="button" className={`${MENU_ITEM_CLASS} disabled:opacity-50`} disabled={pending} aria-busy={pending} onClick={() => void copy()}>
            <Copy aria-hidden />
            {pending ? "Preparando cópia…" : "Copiar para meus repertórios"}
          </button>
          {error && <div className="px-3 py-2"><FormError message={error} /></div>}
        </>
      )}
    </>
  );
}

export function SharedRepertoireMenu({ token, returnHref }: { token: string; returnHref?: string }) {
  return <MoreActionsMenu label="Mais ações do repertório"><CloneSharedRepertoire token={token} returnHref={returnHref} /></MoreActionsMenu>;
}
