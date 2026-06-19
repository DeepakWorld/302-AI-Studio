# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY patches ./patches

# Disable postinstall hooks
ENV NPM_CONFIG_IGNORE_SCRIPTS=true

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app ./
EXPOSE 3000
CMD ["pnpm", "start"]
