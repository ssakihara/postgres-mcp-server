# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies and pnpm
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    npm install -g pnpm && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm run build

# Production stage
FROM node:22-slim AS production

WORKDIR /app

# Install runtime dependencies (pg may need native dependencies)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 && \
    rm -rf /var/lib/apt/lists/*

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set entrypoint
ENTRYPOINT ["node", "dist/index.js"]
