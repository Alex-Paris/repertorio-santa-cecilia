import { z } from "zod";

import { isValidIsoDate } from "@/features/liturgy/domain/calendar";
import { LITURGICAL_MOMENT_IDS, type LiturgicalMomentId } from "@/features/liturgy/domain/vocabulary";
import { MUSICAL_KEYS, type MusicalKey } from "@/features/songs/domain/musical-key";
import { entityIdSchema } from "@/features/songs/domain/song-schema";
import { isSafeExternalUrl } from "@/lib/utils/is-safe-external-url";

/** Versão do texto que o proprietário confirma. Mudar o texto exige mudar a versão. */
export const RIGHTS_DECLARATION_VERSION = "2026-11-v1";

export const MAX_SHARE_AUTHORIZATIONS = 500;

/** O que uma cifra publicada pode ser: nunca mais do que um destes três casos. */
export type PublicShareContent =
  | { kind: "chordpro"; chordPro: string }
  | { kind: "external-link"; sourceUrl: string }
  | { kind: "none" }
  /** A música do catálogo saiu do ar ou perdeu a permissão de redistribuição. */
  | { kind: "unavailable" };

export interface PublicShareItem {
  id: string;
  position: number;
  title: string;
  /** Pode ser vazio: música do catálogo com autoria ainda não confirmada. */
  artist: string;
  /** Ausente quando o tom original não é conhecido. */
  originalKey?: MusicalKey;
  transposeSemitones: number;
  content: PublicShareContent;
  /** Momento da missa em que a música entra, quando o repertório é de uma celebração. */
  moment?: LiturgicalMomentId;
}

/** Celebração a que o repertório se destina. A data só entra se o proprietário escolher. */
export interface PublicShareMass {
  title: string;
  date?: string;
}

/** Tudo o que um visitante sem conta consegue ler. Campos novos precisam entrar aqui de propósito. */
export interface PublicShareSnapshot {
  name: string;
  description: string;
  mass?: PublicShareMass;
  items: PublicShareItem[];
}

const contentSchema: z.ZodType<PublicShareContent> = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("chordpro"), chordPro: z.string().min(1).max(100_000) }),
  z.strictObject({
    kind: z.literal("external-link"),
    sourceUrl: z.string().max(2048).refine(isSafeExternalUrl),
  }),
  z.strictObject({ kind: z.literal("none") }),
  z.strictObject({ kind: z.literal("unavailable") }),
]);

const publicShareItemSchema: z.ZodType<PublicShareItem> = z.strictObject({
  id: z.string().regex(/^[a-f0-9]{16,64}$/),
  position: z.number().int().positive(),
  title: z.string().min(1).max(300),
  artist: z.string().max(300),
  originalKey: z.enum(MUSICAL_KEYS).optional(),
  transposeSemitones: z.number().int().min(-11).max(11),
  content: contentSchema,
  moment: z.enum(LITURGICAL_MOMENT_IDS).optional(),
});

/** `strictObject` em todos os níveis: um campo inesperado invalida a publicação inteira. */
export const publicShareSnapshotSchema: z.ZodType<PublicShareSnapshot> = z.strictObject({
  name: z.string().min(1).max(300),
  description: z.string().max(2000),
  mass: z
    .strictObject({
      title: z.string().min(1).max(300),
      date: z.string().refine(isValidIsoDate).optional(),
    })
    .optional(),
  items: z.array(publicShareItemSchema).min(1),
});

const authorizationSchema = z.strictObject({
  songId: entityIdSchema,
  confirmed: z.literal(true, { error: "Confirme os direitos de cada cifra publicada." }),
  declarationVersion: z.literal(RIGHTS_DECLARATION_VERSION, {
    error: "A declaração de direitos mudou. Recarregue a página.",
  }),
});

export type ShareAuthorizationInput = z.infer<typeof authorizationSchema>;

export const shareSelectionSchema = z.strictObject({
  authorizations: z
    .array(authorizationSchema)
    .max(MAX_SHARE_AUTHORIZATIONS)
    .refine(
      (list) => new Set(list.map((entry) => entry.songId)).size === list.length,
      "Há músicas repetidas na autorização.",
    ),
  /** Publica também a data da celebração. Sem isto, só o nome da celebração aparece. */
  includeMassDate: z.boolean().optional(),
});

const contentHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const publishShareSchema = shareSelectionSchema.extend({ expectedHash: contentHashSchema });

export const updateShareSchema = publishShareSchema.extend({
  expectedRevision: z.number().int().positive(),
});

export type ShareSelection = z.infer<typeof shareSelectionSchema>;
export type PublishShareInput = z.infer<typeof publishShareSchema>;
export type UpdateShareInput = z.infer<typeof updateShareSchema>;

export const sharePreviewSchema = z.strictObject({
  snapshot: publicShareSnapshotSchema,
  contentHash: contentHashSchema,
});

export type SharePreview = z.infer<typeof sharePreviewSchema>;

export const shareSummarySchema = z.strictObject({
  id: z.string(),
  repertoireId: z.string(),
  name: z.string(),
  revision: z.number().int().positive(),
  /** `null` quando a chave de assinatura não está configurada. */
  path: z.string().nullable(),
  itemCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime(),
  /** Autorizações ainda válidas: o conteúdo não mudou desde a confirmação. */
  authorizedSongIds: z.array(z.string()),
  /** A publicação atual mostra a data da celebração. */
  includeMassDate: z.boolean().optional(),
  /** A biblioteca mudou e a publicação continua com o conteúdo anterior. */
  outdated: z.boolean(),
  /** Títulos publicados que não estão mais no repertório privado. */
  removedTitles: z.array(z.string()),
});

export type ShareSummary = z.infer<typeof shareSummarySchema>;
