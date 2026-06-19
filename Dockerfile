# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY patches ./patches

# Install all deps (including tsup)
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

# Build SDK before app
RUN pnpm -C packages/plugin-sdk build
RUN pnpm exec svelte-kit sync
RUN pnpm exec vite build
