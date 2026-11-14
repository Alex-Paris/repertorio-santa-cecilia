#!/usr/bin/env node
/**
 * Concede, revoga ou lista o papel de administração do catálogo. É o único caminho:
 * não há rota HTTP para isso, e nenhuma conta vira administradora sozinha.
 *
 *   pnpm catalog:admin grant --email pessoa@exemplo.com [--note "motivo"]
 *   pnpm catalog:admin revoke --email pessoa@exemplo.com
 *   pnpm catalog:admin list
 */
import { userInfo } from "node:os";
import { parseArgs } from "node:util";

import { ObjectId } from "mongodb";

import { withDatabase } from "./mongo-env.mjs";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { email: { type: "string" }, note: { type: "string" } },
});
const [command] = positionals;

if (!["grant", "revoke", "list"].includes(command) || (command !== "list" && !values.email)) {
  console.error("Uso: catalog-admin.mjs grant|revoke --email <e-mail>  |  catalog-admin.mjs list");
  process.exit(1);
}

await withDatabase(async (db, dbName) => {
  const admins = db.collection("catalog_admins");
  await admins.createIndex({ userId: 1 }, { unique: true });

  if (command === "list") {
    const grants = await admins.find({}, { projection: { _id: 0 } }).toArray();
    const users = await db
      .collection("user")
      // O Better Auth grava o _id como ObjectId; o papel guarda a forma textual.
      .find(
        { _id: { $in: grants.flatMap((grant) => (ObjectId.isValid(grant.userId) ? [new ObjectId(grant.userId)] : [])) } },
        { projection: { email: 1 } },
      )
      .toArray()
      .catch(() => []);
    for (const grant of grants) {
      const user = users.find((candidate) => String(candidate._id) === grant.userId);
      console.log(`${grant.userId}\t${user?.email ?? "(conta não encontrada)"}\t${grant.grantedAt.toISOString()}`);
    }
    if (grants.length === 0) {
      console.log("Nenhuma conta administradora.");
    }
    return;
  }

  // O cadastro precisa existir: o papel nunca é concedido a um e-mail sem conta.
  const user = await db.collection("user").findOne({ email: values.email.trim().toLowerCase() });
  if (!user) {
    console.error(`Nenhuma conta com o e-mail informado em ${dbName}.`);
    process.exitCode = 1;
    return;
  }
  const userId = String(user._id);

  if (command === "grant") {
    const result = await admins.updateOne(
      { userId },
      {
        $setOnInsert: {
          userId,
          grantedAt: new Date(),
          grantedBy: `${userInfo().username}@linha-de-comando`,
          ...(values.note ? { note: values.note } : {}),
        },
      },
      { upsert: true },
    );
    console.log(result.upsertedCount ? "Papel concedido." : "A conta já era administradora.");
  } else {
    const result = await admins.deleteOne({ userId });
    console.log(result.deletedCount ? "Papel revogado." : "A conta não era administradora.");
  }
});
