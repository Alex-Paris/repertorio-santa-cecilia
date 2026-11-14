import { afterAll } from "vitest";

import { createLibraryService } from "@/server/library/library-service";
import { describeRepositoryContract } from "@/test/repository-contract";

import { clearDatabase, dropTestDatabase } from "./helpers";

afterAll(dropTestDatabase);

describeRepositoryContract("MongoDB", async () => {
  await clearDatabase();
  const { songs, repertoires } = createLibraryService("usuario-contrato");
  return { songs, repertoires };
});
