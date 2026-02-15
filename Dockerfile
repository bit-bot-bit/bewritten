# Stage 1: Build frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV BEWRITTEN_API_PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]
