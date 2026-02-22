# ---------- Base image ----------
FROM node:24-alpine AS base

# Enable corepack to use pnpm
RUN corepack enable

WORKDIR /app


# ---------- Dependencies (production only) ----------
FROM base AS deps

COPY package.json pnpm-lock.yaml ./

# Install only production deps
RUN pnpm install --frozen-lockfile --prod


# ---------- Build stage ----------
FROM base AS build

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build TS -> JS
RUN pnpm build

# ---------- Runner stage ----------

FROM node:24-alpine AS runner

RUN corepack enable

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER appuser

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
