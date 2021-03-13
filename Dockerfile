# TypeScript build
FROM node:14-alpine AS ts-builder
LABEL org.opencontainers.image.source https://github.com/Kesin11/CIAnalyzer
LABEL org.opencontainers.image.authors kesin1202000@gmail.com
WORKDIR /build

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run clean && npm run build

# Install production packages
FROM node:14-alpine AS prod-builder
WORKDIR /build

COPY package*.json ./
RUN npm ci --production

# Runtime image
FROM node:14-alpine
WORKDIR /ci_analyzer

# Resolve nodejs pid=1 problem
RUN apk add --no-cache tini

COPY . .
COPY --from=ts-builder /build/dist ./dist
COPY --from=prod-builder /build/node_modules ./node_modules

# Make "ci_analyzer" command alias
RUN cd dist && ln -s index.js ci_analyzer && chmod +x ci_analyzer
ENV PATH=/ci_analyzer/dist:$PATH

ENTRYPOINT [ "/sbin/tini", "--", "node", "/ci_analyzer/dist/index.js" ]

WORKDIR /app
