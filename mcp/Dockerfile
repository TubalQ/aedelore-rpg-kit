# Stage 1: build
FROM docker.io/library/node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build
# Only the dependencies the server runs with go on to the next stage
# (no typescript, tsx, esbuild).
RUN npm prune --omit=dev

# Stage 2: production
FROM docker.io/library/node:24-alpine
RUN apk add --no-cache tini
WORKDIR /app
# Production: express answers errors (e.g. malformed JSON) without a stack trace.
ENV NODE_ENV=production

COPY --from=build /app/dist dist/
COPY --from=build /app/node_modules node_modules/
COPY --from=build /app/package.json ./

USER node
EXPOSE 3100

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
