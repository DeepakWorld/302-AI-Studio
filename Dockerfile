# Stage 1: Build dependencies and sub-packages
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy workspace configuration and manifests
COPY package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY patches ./patches

# Install all dependencies at the root
RUN pnpm install --frozen-lockfile

# Copy the rest of the application source
COPY . .

# Explicitly install/relink dependencies inside the sub-package to generate missing .bin links
RUN pnpm --filter @302ai/studio-plugin-sdk install --no-frozen-lockfile

# Build the plugin-sdk
RUN pnpm --filter @302ai/studio-plugin-sdk build

# Run SvelteKit sync
RUN pnpm --filter 302-ai-studio exec svelte-kit sync

# Build the main application
RUN pnpm --filter 302-ai-studio exec vite build