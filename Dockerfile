# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files and lockfile
COPY package.json pnpm-lock.yaml ./

# Copy workspaces and patches
COPY packages ./packages
COPY patches ./patches

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the app
COPY . .
RUN pnpm build

# Stage 2: Runtime
FROM node:18-alpine
WORKDIR /app

# Install pnpm in runtime image
RUN npm install -g pnpm

# Copy built app from builder
COPY --from=builder /app ./

EXPOSE 3000
CMD ["pnpm", "start"]
