# Stage 1: Build dependencies and sub-packages using Node 22
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy workspace configuration and manifests
COPY package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY patches ./patches

# Install all workspace dependencies at the root
RUN pnpm install --frozen-lockfile

# Copy the rest of the application source
COPY . .

# Build the sub-package (plugin-sdk)
RUN pnpm --filter @302ai/studio-plugin-sdk build

# Run SvelteKit sync for the main app
RUN pnpm --filter 302-ai-studio exec svelte-kit sync

# Build the main application
RUN pnpm --filter 302-ai-studio exec vite build


# Stage 2: Runtime (lean image)
FROM node:22-alpine
WORKDIR /app

RUN npm install -g pnpm

# Copy manifests and patches so the lockfile resolves patches correctly
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built outputs from builder
COPY --from=builder /app/packages/plugin-sdk/dist ./packages/plugin-sdk/dist
COPY --from=builder /app/build ./build
COPY --from=builder /app/.vite ./vite

# Healthcheck for container orchestration (Kubernetes/AKS)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["pnpm", "start"]