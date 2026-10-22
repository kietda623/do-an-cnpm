FROM node:24.18.0-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /workspace

ARG APP_FILTER
ENV APP_FILTER=${APP_FILTER}

RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile && test -n "$APP_FILTER"

EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter \"$APP_FILTER\" dev"]
