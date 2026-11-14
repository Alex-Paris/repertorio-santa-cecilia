import * as exportRoute from "@/app/api/v1/library/export/route";
import * as importRoute from "@/app/api/v1/library/import/route";
import * as previewRoute from "@/app/api/v1/library/import/preview/route";
import * as statusRoute from "@/app/api/v1/library/imports/[importId]/route";
import * as moveRoute from "@/app/api/v1/library/repertoires/[id]/items/[itemId]/move/route";
import * as itemRoute from "@/app/api/v1/library/repertoires/[id]/items/[itemId]/route";
import * as itemsRoute from "@/app/api/v1/library/repertoires/[id]/items/route";
import * as repertoireRoute from "@/app/api/v1/library/repertoires/[id]/route";
import * as repertoiresRoute from "@/app/api/v1/library/repertoires/route";
import * as songRoute from "@/app/api/v1/library/songs/[id]/route";
import * as songsRoute from "@/app/api/v1/library/songs/route";
import type { FetchLike } from "@/features/library/data/remote/library-api";

import { ORIGIN } from "./helpers";

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
type RouteModule = Partial<Record<string, Handler>>;

function routeModule(route: object): RouteModule {
  return route as RouteModule;
}

const ROUTES: [RegExp, RouteModule, string[]][] = [
  [/^\/songs$/, routeModule(songsRoute), []],
  [/^\/songs\/([^/]+)$/, routeModule(songRoute), ["id"]],
  [/^\/repertoires$/, routeModule(repertoiresRoute), []],
  [/^\/repertoires\/([^/]+)$/, routeModule(repertoireRoute), ["id"]],
  [/^\/repertoires\/([^/]+)\/items$/, routeModule(itemsRoute), ["id"]],
  [/^\/repertoires\/([^/]+)\/items\/([^/]+)$/, routeModule(itemRoute), ["id", "itemId"]],
  [/^\/repertoires\/([^/]+)\/items\/([^/]+)\/move$/, routeModule(moveRoute), ["id", "itemId"]],
  [/^\/import\/preview$/, routeModule(previewRoute), []],
  [/^\/import$/, routeModule(importRoute), []],
  [/^\/imports\/([^/]+)$/, routeModule(statusRoute), ["importId"]],
  [/^\/export$/, routeModule(exportRoute), []],
];

/** Executa as rotas reais, com o cookie da sessão, no lugar da rede. */
export function routeFetch(cookie: string): FetchLike {
  return async (input, init) => {
    const path = input.replace("/api/v1/library", "");
    const method = init.method ?? "GET";

    for (const [pattern, route, names] of ROUTES) {
      const match = pattern.exec(path);
      const handler = match && route[method];

      if (match && handler) {
        const params = Object.fromEntries(names.map((name, index) => [name, match[index + 1]]));
        const headers = new Headers(init.headers);
        headers.set("cookie", cookie);
        headers.set("origin", ORIGIN);

        return handler(new Request(`${ORIGIN}${input}`, { method, headers, body: init.body }), {
          params: Promise.resolve(params),
        });
      }
    }
    throw new Error(`Rota não encontrada: ${method} ${path}`);
  };
}
