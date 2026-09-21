# Multi-stage production image using Next's standalone output — the
# final stage only carries the traced files it needs, not node_modules.
FROM node:22-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN useradd --create-home --shell /bin/bash tr7
USER tr7

COPY --from=builder --chown=tr7:tr7 /app/.next/standalone ./
COPY --from=builder --chown=tr7:tr7 /app/.next/static ./.next/static
COPY --from=builder --chown=tr7:tr7 /app/public ./public

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
