"use client";

import { cn } from "cn";
import { CircleCheck, CloudOff, Download, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ChangeEvent, ReactNode } from "react";

import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { FormError } from "@/components/layout/form-error";
import { ContentSkeleton } from "@/components/layout/page-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatSongCount } from "@/features/songs/domain/song";
import { downloadTextFile } from "@/lib/utils/download-file";

import type { LibraryCounts } from "../migration/migration-flow";
import { DownloadLegacyBackupButton } from "./export-backup-button";
import { LegacyDeletion } from "./legacy-deletion";
import { useLibraryMigration } from "./use-library-migration";

const COPY_NOTICE =
  "A importação copiará estes dados para sua conta. Eles estão vinculados a este navegador, e não a uma conta: confira se são seus. A biblioteca deste navegador não será apagada nem sincronizada automaticamente.";

const CONFIRM_DESCRIPTION =
  "Suas músicas e repertórios deste navegador serão copiados para sua conta. Os dados locais permanecem aqui, esta cópia não cria sincronização e nada na conta será substituído. A conclusão depende da confirmação do servidor.";

function formatRepertoireCount(count: number): string {
  return count === 1 ? "1 repertório" : `${count} repertórios`;
}

function CountsCard({ title, counts }: { title: string; counts: LibraryCounts }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{formatSongCount(counts.songs)}</p>
      <p className="text-sm text-muted-foreground">{formatRepertoireCount(counts.repertoires)}</p>
    </div>
  );
}

function Status({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
      {children}
    </p>
  );
}

function BackupFileInput({ onChoose, error }: { onChoose: (file: File) => void; error: string | null }) {
  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file) {
      onChoose(file);
    }
    event.target.value = "";
  }

  return (
    <div className="space-y-2 border-t pt-4">
      <label htmlFor="legacy-backup-file" className="block text-sm font-medium">
        Arquivo de backup
      </label>
      <p className="text-sm text-muted-foreground">
        Se você tem um arquivo JSON exportado pelo aplicativo, pode usá-lo no lugar dos dados deste
        navegador.
      </p>
      <input
        id="legacy-backup-file"
        type="file"
        accept=".json,application/json"
        className="block w-full text-sm"
        onChange={handleChange}
      />
      {error && <FormError message={error} />}
    </div>
  );
}

export function MigrationScreen({ userId }: { userId: string }) {
  const migration = useLibraryMigration(userId);
  const busy = migration.view.step === "importing" || migration.view.step === "verifying";

  return (
    <div className="space-y-10">
      <MigrationSteps migration={migration} />
      <LegacyDeletion legacy={migration.legacy} disabled={busy} />
    </div>
  );
}

function MigrationSteps({ migration }: { migration: ReturnType<typeof useLibraryMigration> }) {
  const { view, legacy, source, fromFile, fileError, chooseFile, startImport, verify, repeat, discard } =
    migration;
  const sourceTitle = fromFile ? "Arquivo de backup" : "Biblioteca antiga";
  const fileInput = <BackupFileInput onChoose={chooseFile} error={fileError} />;

  const accountLink = (
    <Link href="/biblioteca" className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}>
      Abrir minha biblioteca
    </Link>
  );

  switch (view.step) {
    case "checking":
      return <ContentSkeleton />;

    case "local-unavailable":
      return (
        <div className="max-w-xl space-y-5">
          <EmptyState
            icon={view.reason === "none" ? Info : TriangleAlert}
            title={view.reason === "none" ? "Nada para importar" : "Não é possível importar agora"}
            description={view.message}
            action={
              legacy.status === "blocked" ? (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() =>
                    downloadTextFile("repertorio-dados-originais.json", legacy.rawData, "application/json")
                  }
                >
                  <Download data-icon="inline-start" aria-hidden />
                  Baixar dados originais
                </Button>
              ) : undefined
            }
          />
          {fileInput}
        </div>
      );

    case "ready":
      return (
        <div className="max-w-xl space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <CountsCard title={sourceTitle} counts={view.local} />
            <CountsCard title="Sua conta" counts={view.remote} />
          </div>
          {!fromFile && legacy.status === "ready" && legacy.onlyExamples && (
            <p className="text-sm text-muted-foreground">
              Esta biblioteca contém apenas os exemplos criados pelas versões anteriores do aplicativo.
            </p>
          )}
          <Status>
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {COPY_NOTICE}
          </Status>
          <div className="flex flex-wrap gap-2">
            {source && <DownloadLegacyBackupButton library={source} />}
            <ConfirmDialog
              trigger={<Button size="lg">Copiar para minha conta</Button>}
              title="Copiar para sua conta?"
              description={CONFIRM_DESCRIPTION}
              confirmLabel="Confirmar cópia"
              onConfirm={startImport}
            />
          </div>
          {fileInput}
        </div>
      );

    case "conflict":
      return (
        <div className="max-w-xl space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <CountsCard title={sourceTitle} counts={view.local} />
            <CountsCard title="Sua conta" counts={view.remote} />
          </div>
          <FormError message="Sua conta já possui músicas ou repertórios. A importação para uma conta já preenchida ainda não é suportada. Nada foi alterado, em nenhuma das bibliotecas." />
          <div className="flex flex-wrap gap-2">
            {source && <DownloadLegacyBackupButton library={source} />}
            {accountLink}
          </div>
        </div>
      );

    case "importing":
      return (
        <Status>
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Copiando para sua conta. Não feche esta página.
        </Status>
      );

    case "verifying":
      return (
        <Status>
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Verificando o resultado da cópia.
        </Status>
      );

    case "uncertain":
      return (
        <div className="max-w-xl space-y-4">
          <EmptyState
            icon={CloudOff}
            title="Resultado ainda não confirmado"
            description={
              view.statusChecked
                ? "O servidor não tem registro de uma cópia concluída. Isso não confirma sucesso nem falha."
                : "Não foi possível consultar o servidor. A cópia pode ter sido concluída ou não."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="lg" onClick={verify}>
                  Verificar novamente
                </Button>
                {view.canRepeat && (
                  <Button variant="outline" size="lg" onClick={repeat}>
                    Repetir com o mesmo conteúdo
                  </Button>
                )}
              </div>
            }
          />
          {!view.canRepeat && (
            <p className="text-sm text-muted-foreground">
              O conteúdo mudou depois desta tentativa, por isso ela não pode ser repetida.
            </p>
          )}
          {view.statusChecked && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="lg">
                  Descartar esta tentativa
                </Button>
              }
              title="Descartar esta tentativa?"
              description="Use somente se tiver certeza de que não quer acompanhar esta cópia. Uma nova cópia só é aceita se a conta continuar vazia, então dados não serão duplicados."
              confirmLabel="Descartar tentativa"
              onConfirm={discard}
            />
          )}
        </div>
      );

    case "completed":
      return (
        <div className="max-w-xl space-y-5">
          <Status>
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-chord" aria-hidden />
            Cópia concluída: {formatSongCount(view.imported.songs)} e{" "}
            {formatRepertoireCount(view.imported.repertoires)}. Os dados deste navegador
            continuam intactos.
          </Status>
          {view.remote === null && (
            <FormError message="A cópia foi concluída, mas os dados da conta não puderam ser carregados agora. Não faça uma nova cópia." />
          )}
          {view.remote !== null && !view.countsMatch && (
            <FormError message="As quantidades na sua conta diferem da cópia, possivelmente por alterações feitas depois dela. Confira a biblioteca da conta." />
          )}
          <div className="flex flex-wrap gap-2">
            {accountLink}
            <Button variant="ghost" size="lg" className="h-10 px-4" onClick={discard}>
              Iniciar nova cópia
            </Button>
          </div>
        </div>
      );

    case "session-expired":
      return (
        <EmptyState
          icon={TriangleAlert}
          title="Sua sessão expirou"
          description="Entre novamente para acompanhar esta cópia. Se ela já tiver sido iniciada, o resultado será consultado."
          action={
            <Link href="/entrar" className={cn(buttonVariants({ size: "lg" }))}>
              Entrar
            </Link>
          }
        />
      );

    case "error":
      return (
        <div className="max-w-xl space-y-4">
          <FormError message={view.message} />
          <Button variant="outline" size="lg" className="h-10 px-4" onClick={verify}>
            Tentar novamente
          </Button>
        </div>
      );
  }
}
