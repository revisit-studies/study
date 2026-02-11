FROM node:lts AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

COPY . .

ARG BASE_PATH=/
RUN set -eux; \
  VITE_BASE_PATH="$BASE_PATH" yarn build

FROM nginx:stable AS runtime

ARG BASE_PATH=/

COPY --from=builder /app/dist /tmp/dist
COPY nginx-docker.conf /tmp/nginx-docker.conf

RUN set -eux; \
  rm -rf /usr/share/nginx/html/*; \
  if [ "$BASE_PATH" = "/" ]; then \
    LOCATION_PATH="/"; \
    INDEX_FALLBACK="/index.html"; \
    ROOT_REDIRECT_DIRECTIVE="try_files /index.html =404;"; \
    cp -R /tmp/dist/. /usr/share/nginx/html/; \
  else \
    LOCATION_PATH="$BASE_PATH"; \
    INDEX_FALLBACK="${BASE_PATH}index.html"; \
    ROOT_REDIRECT_DIRECTIVE="return 302 ${BASE_PATH};"; \
    TARGET_DIR="/usr/share/nginx/html${BASE_PATH}"; \
    mkdir -p "$TARGET_DIR"; \
    cp -R /tmp/dist/. "$TARGET_DIR"; \
  fi; \
  sed \
    -e "s|__ROOT_REDIRECT_DIRECTIVE__|${ROOT_REDIRECT_DIRECTIVE}|g" \
    -e "s|__LOCATION_PATH__|${LOCATION_PATH}|g" \
    -e "s|__INDEX_FALLBACK__|${INDEX_FALLBACK}|g" \
    /tmp/nginx-docker.conf > /etc/nginx/conf.d/default.conf

EXPOSE 8080
