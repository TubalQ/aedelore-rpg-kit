# Stage 1: build
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# Stage 2: production
FROM node:22-alpine
RUN apk add --no-cache tini
WORKDIR /app

COPY --from=build /app/dist dist/
COPY --from=build /app/node_modules node_modules/
COPY --from=build /app/package.json ./

USER node
EXPOSE 3100

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
