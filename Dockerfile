# MarketLink Agri-Hub Pakistan — production container
FROM node:20-alpine

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies (cached layer)
COPY package.json package-lock.json ./
RUN npm ci

# Build the app. A placeholder DATABASE_URL is enough at build time —
# the real one is supplied at runtime (docker-compose / cloud host).
COPY . .
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=${DATABASE_URL}
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Tables and demo data are created automatically on first request.
CMD ["npm", "start"]
