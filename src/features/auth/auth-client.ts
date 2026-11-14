import { createAuthClient } from "better-auth/react";

/** Cliente do navegador. Sem `baseURL`, usa a própria origem da aplicação. */
export const authClient = createAuthClient({ fetchOptions: { cache: "no-store" } });
