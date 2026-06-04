# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Final stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js ./
COPY public/ ./public/

ENV PORT=8080
EXPOSE 8080

# Run as non-root user for security compliance
USER node
CMD ["node", "server.js"]
