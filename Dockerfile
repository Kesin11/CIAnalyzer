# TypeScript build stage
FROM node:12-alpine AS ts-builder
WORKDIR /build

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run clean && npm run build

# Setup production stage
FROM node:12-alpine
WORKDIR /ci_analyzer

COPY package*.json ./
RUN npm install --production

COPY . .
COPY --from=ts-builder /build/dist ./dist

# Resolve nodejs pid=1 problem
RUN apk add --no-cache tini
ENTRYPOINT [ "/sbin/tini", "--", "node", "/ci_analyzer/dist/index.js" ]

WORKDIR /app