# Stage 1: Build stage
FROM node:18-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy remaining files (tsconfig, nest-cli, src)
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Build seed file for production (compile TypeScript to JavaScript)
RUN npx tsc prisma/seed.ts \
  --outDir dist/prisma \
  --module commonjs \
  --target es2020 \
  --esModuleInterop \
  --resolveJsonModule \
  --skipLibCheck \
  --moduleResolution node

# Stage 2: Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production

# Copy prisma schema from builder
COPY --from=builder /app/prisma ./prisma

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy built seed file from builder
COPY --from=builder /app/dist/prisma/seed.js ./dist/prisma/seed.js

# Copy Prisma generated client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Expose port
EXPOSE 4000

# Start the application
CMD ["npm", "run", "start:prod"]

