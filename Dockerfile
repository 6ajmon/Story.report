# syntax=docker/dockerfile:1
# Story.report: Node 20 + Typst (render PNG) + Next.js web UI.
#
# Uzycie:
#   docker build -t story-report .
#   docker run --rm -p 3000:3000 --env-file .env -v "$PWD/generated:/app/generated" story-report
#
# Wersje mozna nadpisac przy budowaniu, np.:
#   docker build --build-arg TYPST_VERSION=0.13.1 -t story-report .
ARG NODE_VERSION=20
ARG TYPST_VERSION=0.15.1

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV DEBIAN_FRONTEND=noninteractive

# --- Typst (statyczna binarka musl) ---
FROM base AS typst
ARG TYPST_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends curl xz-utils ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" -o /tmp/typst.tar.xz \
 && tar -xJf /tmp/typst.tar.xz -C /tmp \
 && install -m 0755 /tmp/typst-x86_64-unknown-linux-musl/typst /usr/local/bin/typst \
 && typst --version

# --- zaleznosci (root CLI + web UI) ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY web/package.json web/package-lock.json ./web/
RUN npm --prefix web ci

# --- build Next.js ---
FROM deps AS build
COPY . .
RUN npm --prefix web run build

# --- runtime ---
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-dejavu-core fonts-liberation2 fonts-noto-core \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=typst /usr/local/bin/typst /usr/local/bin/typst
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/web/node_modules ./web/node_modules
COPY . .
COPY --from=build /app/web/.next ./web/.next
RUN mkdir -p /app/generated/assets && chown -R node:node /app
USER node
EXPOSE 3000
# Next.js startuje z /app/web; proces.cwd()=.. => /app, skad generator czyta .env.
WORKDIR /app/web
CMD ["npm", "run", "start"]
