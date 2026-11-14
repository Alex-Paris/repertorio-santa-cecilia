import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  redirects: async () => [
    { source: "/conta/migrar", destination: "/conta/importar-biblioteca-antiga", permanent: false },
  ],
  // O caminho de um link público é a própria credencial de acesso: não vai para os logs.
  logging: {
    incomingRequests: { ignore: [/^\/s\//, /^\/api\/v1\/public\//] },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
