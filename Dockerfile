# Stage 1: Build dependencies and sub-packages
FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY packages ./packages

RUN pnpm install --no-frozen-lockfile --prod=false --recursive

COPY . .

RUN pnpm --filter @302ai/studio-plugin-sdk install --no-frozen-lockfile
RUN pnpm --filter @302ai/studio-plugin-sdk build

RUN pnpm exec svelte-kit sync

# Build the application with increased heap memory to prevent OOM crashes
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm exec vite build

# Stage 2: Runtime (lean image)
FROM node:22-alpine
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod

# Copy built Electron/Vite outputs from the builder stage (.vite/build directory)
COPY --from=builder /app/packages/plugin-sdk/dist ./packages/plugin-sdk/dist
COPY --from=builder /app/.vite/build ./out

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["pnpm", "start"]