# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY patches ./patches

# Disable postinstall hooks
ENV NPM_CONFIG_IGNORE_SCRIPTS=true

RUN pnpm install --frozen-lockfile --prod=false

COPY . .

# Run svelte-kit sync BEFORE vite build
RUN pnpm -C packages/plugin-sdk build
RUN pnpm exec svelte-kit sync
RUN pnpm exec vite build


# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app ./
EXPOSE 3000
CMD ["pnpm", "start"]
