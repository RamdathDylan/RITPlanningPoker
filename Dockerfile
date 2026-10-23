# syntax=docker/dockerfile:1
# Multi-stage build: install and build with all dependencies, then copy only what runs in
# production into a small image. One image runs both the app and the migrations.

FROM node:24.22.1-trixie-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
RUN npm ci
COPY shared shared
COPY client client
RUN npm run build --workspace client

FROM node:24.22.1-trixie-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    CLIENT_DIST_DIR=/app/client/dist
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
RUN npm ci --omit=dev && npm cache clean --force
COPY shared shared
COPY server/src server/src
COPY --from=build /app/client/dist client/dist

# Run as the unprivileged "node" user that the official image provides, never as root.
USER node
EXPOSE 3000

# Docker marks the container unhealthy if /health stops answering. Uses Node's built-in fetch,
# because the slim image has no curl.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

# Node runs directly (not through npm) so it receives SIGTERM and shuts down gracefully.
CMD ["node", "server/src/index.js"]
