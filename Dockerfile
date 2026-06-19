# Stage 1: Build dependencies and sub-packages using Node 22
FROM node:22-alpine AS builder
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

# Force re-link dependencies for the sub-package
RUN pnpm --filter @302ai/studio-plugin-sdk install --no-frozen-lockfile

# Build the plugin-sdk
RUN pnpm --filter @302ai/studio-plugin-sdk build

# Run SvelteKit sync
RUN pnpm --filter 302-ai-studio exec svelte-kit sync

# Build the main application
RUN pnpm --filter 302-ai-studio exec vite build


# Stage 2: Runtime
FROM node:22-alpine
WORKDIR /app

RUN npm install -g pnpm

# Copy only manifests
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built outputs from builder
COPY --from=builder /app/packages/plugin-sdk/dist ./packages/plugin-sdk/dist
COPY --from=builder /app/build ./build
COPY --from=builder /app/.vite ./vite

EXPOSE 3000
CMD ["pnpm", "start"]


HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
