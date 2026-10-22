FROM node:24.18.0-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @marketplace/api build

WORKDIR /workspace/apps/api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["pnpm", "start"]
