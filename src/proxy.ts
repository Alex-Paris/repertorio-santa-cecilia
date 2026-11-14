import { NextResponse } from "next/server";

import { PUBLIC_SHARE_HEADERS } from "@/server/http/public-share-headers";

/** Só define cabeçalhos: a validação do link e a revogação ficam no acesso aos dados. */
export function proxy(): NextResponse {
  const response = NextResponse.next();
  for (const [name, value] of Object.entries(PUBLIC_SHARE_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: ["/s/:path*", "/api/v1/public/:path*"],
};
