# stage1: base
FROM node:20 AS base
RUN npm config set registry https://registry.npmmirror.com && npm install -g pnpm

# stage2: deps
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm i --no-frozen-lockfile

# stage3: build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=8192"
ARG ENV=none
RUN pnpm run build:${ENV}

# stage4: runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000/tcp
CMD ["node", "server.js"]
