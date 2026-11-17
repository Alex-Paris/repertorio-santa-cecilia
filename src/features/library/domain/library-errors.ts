export type LibraryErrorCode =
  | "storage-unavailable"
  | "quota-exceeded"
  | "invalid-data"
  | "song-not-found"
  | "repertoire-not-found"
  | "repertoire-item-not-found"
  | "song-in-use"
  | "song-already-in-repertoire"
  | "conflict"
  | "persistence-failed"
  | "remote-library-not-empty"
  | "import-id-conflict"
  | "import-limit-exceeded"
  | "session-expired"
  | "session-changed"
  | "forbidden"
  | "remote-unavailable"
  | "write-uncertain"
  | "invalid-response"
  | "request-cancelled"
  | "share-not-found"
  | "share-conflict"
  | "share-preview-outdated"
  | "share-limit-exceeded"
  | "share-rate-limited"
  | "sharing-disabled"
  | "revision-conflict"
  | "revision-required"
  | "catalog-song-not-found"
  | "catalog-song-unavailable"
  | "catalog-admin-required"
  | "rate-limited"
  | "celebration-not-covered"
  | "celebration-not-found"
  | "submission-not-found"
  | "submission-active"
  | "submission-limit-exceeded"
  | "submission-daily-limit"
  | "submission-already-reviewed"
  | "submission-duplicates"
  | "submission-content-too-large";

const DEFAULT_MESSAGES: Record<LibraryErrorCode, string> = {
  "storage-unavailable":
    "O armazenamento deste navegador não está disponível. Nada foi salvo.",
  "quota-exceeded":
    "O espaço de armazenamento deste navegador acabou. Nada foi salvo. Exporte um backup e remova conteúdo que não usa mais.",
  "invalid-data": "Os dados informados são inválidos. Nada foi salvo.",
  "song-not-found": "Esta música não existe mais na biblioteca.",
  "repertoire-not-found": "Este repertório não existe mais.",
  "repertoire-item-not-found": "Esta música não faz mais parte do repertório.",
  "song-in-use": "Esta música está em uso em repertórios.",
  "song-already-in-repertoire": "Esta música já está neste repertório.",
  conflict: "Já existe um registro com este identificador.",
  "persistence-failed": "Não foi possível salvar os dados agora. Tente novamente.",
  "remote-library-not-empty":
    "Esta conta já possui músicas ou repertórios. Nada foi importado.",
  "import-id-conflict":
    "Este identificador de importação já foi usado com outro conteúdo. Nada foi importado.",
  "import-limit-exceeded": "O backup excede os limites de importação. Nada foi importado.",
  "session-expired": "Sua sessão expirou. Entre novamente para acessar sua conta.",
  "session-changed": "A conta deste navegador mudou. Nada foi alterado.",
  forbidden: "Esta operação não é permitida.",
  "remote-unavailable": "A biblioteca da conta está indisponível no momento.",
  "write-uncertain":
    "Não foi possível confirmar se a alteração foi salva. Confira a biblioteca antes de tentar de novo.",
  "invalid-response": "O servidor enviou uma resposta inesperada.",
  "request-cancelled": "A operação foi cancelada.",
  "share-not-found": "Esta publicação não foi encontrada.",
  "share-conflict": "Esta publicação foi alterada em outro lugar. Recarregue a lista e tente de novo.",
  "share-preview-outdated": "O repertório mudou depois da prévia. Gere uma nova prévia para continuar.",
  "share-limit-exceeded": "O limite de publicações foi atingido.",
  "share-rate-limited": "Muitas publicações em pouco tempo. Aguarde e tente de novo.",
  "sharing-disabled": "O compartilhamento público não está ativado neste ambiente.",
  "revision-conflict":
    "Este conteúdo foi alterado em outro dispositivo ou aba. Nada foi salvo. Confira a versão atual antes de tentar de novo.",
  "revision-required": "A versão esperada do documento não foi informada. Nada foi alterado.",
  "catalog-song-not-found": "Esta música não foi encontrada no catálogo.",
  "catalog-song-unavailable": "Esta música do catálogo não está disponível.",
  "catalog-admin-required": "Esta área é restrita à administração do catálogo.",
  "rate-limited": "Muitas requisições em pouco tempo. Aguarde e tente de novo.",
  "celebration-not-covered":
    "Esta data ainda não está na base de celebrações do Repertório Web. Nenhuma leitura é estimada.",
  "celebration-not-found": "Esta celebração não foi encontrada.",
  "submission-not-found": "Esta sugestão não foi encontrada.",
  "submission-active":
    "Esta música já tem uma sugestão em andamento. Acompanhe-a em Minhas sugestões.",
  "submission-limit-exceeded":
    "Você atingiu o limite de sugestões em análise. Aguarde a revisão das anteriores ou retire alguma.",
  "submission-daily-limit": "Você atingiu o limite de sugestões novas por dia. Tente de novo amanhã.",
  "submission-already-reviewed":
    "Esta sugestão já foi decidida ou mudou de situação. Recarregue para ver o estado atual.",
  "submission-duplicates":
    "Encontramos músicas semelhantes no catálogo. Explique por que esta é outra música antes de enviar.",
  "submission-content-too-large": "A cifra é grande demais para ser enviada como sugestão.",
};

export function isLibraryErrorCode(value: unknown): value is LibraryErrorCode {
  return typeof value === "string" && Object.hasOwn(DEFAULT_MESSAGES, value);
}

export class LibraryError extends Error {
  readonly code: LibraryErrorCode;

  constructor(code: LibraryErrorCode, message: string = DEFAULT_MESSAGES[code]) {
    super(message);
    this.name = "LibraryError";
    this.code = code;
  }
}

export interface RepertoireReference {
  id: string;
  name: string;
}

/** Lançado ao tentar excluir uma música que ainda faz parte de repertórios. */
export class SongInUseError extends LibraryError {
  readonly repertoires: RepertoireReference[];

  constructor(repertoires: RepertoireReference[]) {
    const names = repertoires.map((repertoire) => repertoire.name).join(", ");
    super("song-in-use", `Esta música está em: ${names}. Remova-a desses repertórios antes de excluir.`);
    this.name = "SongInUseError";
    this.repertoires = repertoires;
  }
}

/** Mensagem segura para exibição, qualquer que seja o erro capturado. */
export function getLibraryErrorMessage(error: unknown): string {
  return error instanceof LibraryError
    ? error.message
    : "Ocorreu um erro inesperado. Nada foi alterado.";
}
