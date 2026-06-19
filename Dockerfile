# Stage 1: Build dependencies and sub-packages
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy workspace configuration and manifests
COPY package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY patches ./patches

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application source
COPY . .

# Force install/link dependencies for the sub-package to generate missing .bin links (like tsup)
RUN pnpm --filter @302ai/studio-plugin-sdk install --no-frozen-lockfile

# Build the sub-package
RUN pnpm --filter @302ai/studio-plugin-sdk build

# Run SvelteKit sync at the root
RUN svelte-kit sync

# Build the main SvelteKit application
RUN vite build

# ... [Stage 2: Runtime remains unchanged below] ...

# Stage 2: Runtime (lean image)
FROM node:22-alpine
WORKDIR /app

RUN npm install -g pnpm

# Copy manifests and patches so the lockfile resolves patches correctly
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built outputs from builder stage
COPY --from=builder /app/packages/plugin-sdk/dist ./packages/plugin-sdk/dist
# Update the build output folder below if your adapter outputs to 'dist' or 'output'
COPY --from=builder /app/build ./build 
COPY --from=builder /app/.vite ./vite

# Healthcheck for container orchestration (Kubernetes/AKS)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["pnpm", "start"]