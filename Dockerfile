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

# Make "ci_analyzer" command alias
RUN cd dist && ln -s index.js ci_analyzer && chmod +x ci_analyzer
ENV PATH=/ci_analyzer/dist:$PATH

# Resolve nodejs pid=1 problem
RUN apk add --no-cache tini
ENTRYPOINT [ "/sbin/tini", "--", "node", "/ci_analyzer/dist/index.js" ]

WORKDIR /app
