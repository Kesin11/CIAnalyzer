# TypeScript build stage
FROM node:12-alpine AS ts-builder
WORKDIR /build

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run clean && npm run build

# Setup production stage
FROM node:12-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
COPY --from=ts-builder /build/dist ./dist

ENTRYPOINT [ "npm", "run", "start", "--" ]