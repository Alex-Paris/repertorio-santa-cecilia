import { describe, expect, it } from "vitest";

import initialCatalog from "../data/catalogo-editorial-inicial.json";
import { buildImportPreview, catalogImportDocumentSchema, IMPORT_FORMAT, looksDuplicated } from "./catalog-import";

const record = (fields: Record<string, unknown> = {}) => ({
  importKey: "teste-canto-ficticio",
  title: "Canto Fictício",
  artist: "Autoria Fictícia",
  contentType: "metadata-only",
  metadataSources: [{ title: "Fonte fictícia", url: "https://example.com/fonte", accessedAt: "2026-11-14" }],
  ...fields,
});

describe("arquivo de importação", () => {
  it("exige o formato, a versão e ao menos um registro", () => {
    expect(catalogImportDocumentSchema.safeParse({ format: IMPORT_FORMAT, version: 1, records: [record()] }).success).toBe(true);
    expect(catalogImportDocumentSchema.safeParse({ format: "outro", version: 1, records: [record()] }).success).toBe(false);
    expect(catalogImportDocumentSchema.safeParse({ format: IMPORT_FORMAT, version: 2, records: [record()] }).success).toBe(false);
    expect(catalogImportDocumentSchema.safeParse({ format: IMPORT_FORMAT, version: 1, records: [] }).success).toBe(false);
  });
});

describe("prévia da importação", () => {
  it("registro válido entra como novo, com as fontes à mostra", () => {
    const preview = buildImportPreview([record()], []);
    expect(preview.counts).toEqual({ new: 1, existing: 0, duplicate: 0, invalid: 0 });
    expect(preview.entries[0]).toMatchObject({ status: "new", title: "Canto Fictício", sources: [{ title: "Fonte fictícia" }] });
  });

  it("recusa letra, cifra, conteúdo hospedado, fonte ausente e link inseguro", () => {
    const preview = buildImportPreview(
      [
        record({ importKey: "a", chordPro: "[G]letra" }),
        record({ importKey: "b", lyrics: "letra" }),
        record({ importKey: "c", contentType: "original" }),
        record({ importKey: "d", metadataSources: [] }),
        record({ importKey: "e", contentType: "external-link", sourceUrl: "javascript:alert(1)" }),
        record({ importKey: "f", contentType: "external-link" }),
        record({ importKey: "Chave Inválida" }),
      ],
      [],
    );
    expect(preview.entries.map((entry) => entry.status)).toEqual(Array(7).fill("invalid"));
    expect(preview.entries[2].reason).toBe("A importação aceita só metadados ou link externo.");
    expect(preview.entries[3].reason).toBe("Registre ao menos uma fonte consultada.");
  });

  it("classificação inválida invalida só o registro", () => {
    const preview = buildImportPreview(
      [record({ importKey: "a", classification: { category: "devotional", moments: ["comunhao"] } }), record({ importKey: "b", title: "Outro" })],
      [],
    );
    expect(preview.entries.map((entry) => entry.status)).toEqual(["invalid", "new"]);
    expect(preview.entries[0].reason).toContain("Classificação:");
  });

  it("classificação parcial é completada com valores vazios, nunca inventados", () => {
    const preview = buildImportPreview([record({ classification: { moments: ["comunhao"] } })], []);
    expect(preview.entries[0].classification).toMatchObject({
      category: "liturgical",
      moments: ["comunhao"],
      seasons: [],
      editorialRationale: "",
      guidanceSource: "",
    });
  });

  it("detecta duplicatas no arquivo e no catálogo, sem alterar a música existente", () => {
    const existing = [{ id: "cat-1", title: "Canto  Ficticio", artist: "" }];
    const preview = buildImportPreview(
      [record(), record({ importKey: "outra-chave" }), record({ importKey: "x", title: "Diferente" }), record({ importKey: "x", title: "Mais um" })],
      existing,
    );
    expect(preview.entries.map((entry) => entry.status)).toEqual(["duplicate", "duplicate", "new", "duplicate"]);
    expect(preview.entries[0].existing).toEqual(existing[0]);
  });

  it("importar de novo é idempotente: a mesma chave aparece como já importada", () => {
    const preview = buildImportPreview([record()], [{ id: "cat-9", title: "Título mudado", artist: "", importKey: "teste-canto-ficticio" }]);
    expect(preview.entries[0]).toMatchObject({ status: "existing", existing: { id: "cat-9" } });
    expect(preview.counts.new).toBe(0);
  });

  it("mesmo título com autorias diferentes são músicas diferentes", () => {
    expect(looksDuplicated({ title: "O Senhor dará", artist: "A" }, { title: "O senhor dara", artist: "B" })).toBe(false);
    expect(looksDuplicated({ title: "O Senhor dará", artist: "A" }, { title: "O senhor dara", artist: "" })).toBe(true);
  });
});

describe("catálogo editorial inicial", () => {
  const preview = buildImportPreview(initialCatalog.records, []);

  it("é válido, sem duplicatas, e cabe entre 15 e 30 músicas", () => {
    expect(catalogImportDocumentSchema.safeParse(initialCatalog).success).toBe(true);
    expect(preview.counts.invalid).toBe(0);
    expect(preview.counts.duplicate).toBe(0);
    expect(preview.counts.new).toBeGreaterThanOrEqual(15);
    expect(preview.counts.new).toBeLessThanOrEqual(30);
  });

  it("só metadados com fonte: nenhuma letra, cifra ou tom presumido", () => {
    for (const entry of preview.entries) {
      expect(entry.record?.contentType).toBe("metadata-only");
      expect(entry.record?.originalKey).toBeUndefined();
      expect(entry.sources.length).toBeGreaterThan(0);
      expect(entry.sources.every((source) => source.url?.startsWith("https://"))).toBe(true);
    }
    expect(JSON.stringify(initialCatalog)).not.toMatch(/chordPro|lyrics|letra":/);
  });

  it("classificações vêm com fonte de orientação, e nenhuma se diz conferida", () => {
    for (const entry of preview.entries.filter((candidate) => candidate.classification)) {
      expect(entry.classification?.guidanceSource.trim()).not.toBe("");
    }
    expect(JSON.stringify(initialCatalog)).not.toMatch(/reviewStatus|"review"/);
  });
});
