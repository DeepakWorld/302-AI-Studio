# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages ./packages

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the app
COPY . .
RUN pnpm build

# Stage 2: Runtime
FROM node:18-alpine
WORKDIR /app

# Copy built app from builder
COPY --from=builder /app ./

EXPOSE 3000
CMD ["pnpm", "start"]
