# syntax=docker/dockerfile:1.7
FROM node:20-bookworm-slim AS build

WORKDIR /app
RUN npm install --global pnpm@9.15.9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY apps/cli/package.json apps/cli/tsconfig.json ./apps/cli/
COPY apps/web/package.json apps/web/tsconfig.json ./apps/web/
COPY packages/core/package.json packages/core/tsconfig.json ./packages/core/
RUN pnpm install --frozen-lockfile

COPY apps/cli/src ./apps/cli/src
COPY apps/web/src ./apps/web/src
COPY packages/core/src ./packages/core/src
RUN pnpm build

FROM node:20-bookworm-slim AS runtime

ARG VERSION=dev
ARG GIT_COMMIT=unknown
ARG SOURCE_URL=https://github.com/clawpai/mi-paiai
LABEL org.opencontainers.image.title="mi-paiai" \
      org.opencontainers.image.description="Secure multi-speaker XiaoAI to OpenAI-compatible gateway" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.source="${SOURCE_URL}" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    MIPAIAI_CONFIG_DIR=/app/config \
    PORT=36592
WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=build --chown=node:node /app/apps/web/dist ./apps/web/dist
COPY --from=build --chown=node:node /app/apps/web/package.json ./apps/web/package.json

RUN mkdir -p /app/config \
    && chown -R node:node /app/config

USER node
EXPOSE 36592

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:36592/').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "apps/web/dist/index.js"]
