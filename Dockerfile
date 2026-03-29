FROM node:20-alpine AS build

WORKDIR /app

# Install all dependencies (including dev for TypeScript build)
COPY package.json package-lock.json* ./
RUN npm install --silent

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Note: skip npm prune in build stage to avoid cancellation in constrained CI

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts and production deps
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./

# Entrypoint helper: map common env var `TOKEN` → `OPENHAB_API_TOKEN` at runtime
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Install curl and add the container healthcheck script
COPY docker-healthcheck.sh /usr/local/bin/docker-healthcheck.sh
RUN chmod +x /usr/local/bin/docker-healthcheck.sh && \
  apk add --no-cache curl

EXPOSE 8000
EXPOSE 8001

ENTRYPOINT ["/entrypoint.sh"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD /usr/local/bin/docker-healthcheck.sh
