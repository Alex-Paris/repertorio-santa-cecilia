import "server-only";

import type { z } from "zod";

import { ApiError } from "./api-error";

/** Comporta a maior cifra permitida (100 mil caracteres), mesmo em UTF-8 de vários bytes. */
export const MAX_JSON_BODY_BYTES = 512 * 1024;

function tooLarge(): ApiError {
  return new ApiError(413, "payload_too_large", "O conteúdo enviado é grande demais.");
}

/** Interrompe a leitura ao exceder o limite. O `Content-Length` informado não é confiável. */
async function readTextWithinLimit(request: Request, maxBytes: number): Promise<string> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    throw tooLarge();
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return "";
  }

  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return text + decoder.decode();
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw tooLarge();
    }
    text += decoder.decode(value, { stream: true });
  }
}

/** Lê e valida o corpo. Esquemas estritos fazem campos como `ownerId` serem rejeitados. */
export async function readJsonBody<Output>(
  request: Request,
  schema: z.ZodType<Output>,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<Output> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Envie o conteúdo em JSON.");
  }

  const text = await readTextWithinLimit(request, maxBytes);

  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_input", "O conteúdo enviado não é um JSON válido.");
  }

  const result = schema.safeParse(document);
  if (!result.success) {
    throw new ApiError(400, "invalid_input", "Os dados enviados são inválidos.", {
      fields: [...new Set(result.error.issues.map((issue) => issue.path.join(".")))],
    });
  }
  return result.data;
}
