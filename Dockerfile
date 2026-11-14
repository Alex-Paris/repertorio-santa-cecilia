# Imagem de desenvolvimento. O código é montado como volume pelo docker-compose.yml.
FROM node:24-bookworm-slim AS dev

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable pnpm

WORKDIR /app

# Copia apenas os manifestos: as dependências não são reinstaladas a cada mudança no código.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

EXPOSE 3000

CMD ["pnpm", "dev", "--hostname", "0.0.0.0", "--port", "3000"]
