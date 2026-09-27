# PA Dashboard web frontend — Next.js standalone runtime image.
#
# Multi-stage build: the builder installs all dependencies and produces the
# Next.js standalone output; the runtime image contains only the standalone
# server, static assets and public files. No source checkout, credentials or
# development dependencies are present in the runtime image.

FROM docker.io/library/node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM docker.io/library/node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# Next.js standalone output does not include static assets or public files;
# they must be copied next to the standalone server tree.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]
