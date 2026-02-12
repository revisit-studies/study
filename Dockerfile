FROM node:lts AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

RUN node -e "const fs=require('node:fs');const key='VITE_BASE_PATH=';const lines=fs.readFileSync('.env','utf8').split(/\\r?\\n/);let v='';for(const line of lines){if(line.startsWith(key)) v=line.slice(key.length);}v=v.trim();if((v.startsWith('\"')&&v.endsWith('\"'))||(v.startsWith(\"'\")&&v.endsWith(\"'\"))){v=v.slice(1,-1);}if(!v){throw new Error('VITE_BASE_PATH must be defined in .env');}fs.writeFileSync('/tmp/base_path',v);"

FROM nginx:stable AS runtime

COPY --from=builder /app/dist /tmp/dist
COPY --from=builder /tmp/base_path /tmp/base_path
COPY nginx-docker.conf /tmp/nginx-docker.conf

RUN set -eux; \
  BASE_PATH="$(cat /tmp/base_path)"; \
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
