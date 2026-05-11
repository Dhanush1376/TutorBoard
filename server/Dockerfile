# Use Node.js 22 LTS Alpine for a small, secure footprint
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies if needed (e.g., for native modules)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies (including devDeps for build)
RUN npm install

# Copy source code
COPY . .

# Build TypeScript to JS
RUN npm run build

# --- Production Image ---
FROM node:22-alpine

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy built assets and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy other necessary runtime assets
COPY --from=builder /app/uploads ./uploads
RUN mkdir -p .local-storage
COPY --from=builder /app/.local-storage/ ./.local-storage/

# Expose the API port
EXPOSE 5000

# Use a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

# Healthcheck for Docker/K8s/Render
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --mirror http://localhost:5000/health || exit 1

# Start the server
CMD ["node", "dist/main.js"]
