# Multi-stage build: build frontend with Vite, then run Node server

# Stage 1 - build frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY . .
RUN npm ci && npm run build

# Stage 2 - runtime
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# copy only what we need
COPY package.json package-lock.json* ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
