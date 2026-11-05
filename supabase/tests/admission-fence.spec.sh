#!/usr/bin/env bash
set -euo pipefail
support_dir="$(cd "$(dirname "$0")/.." && pwd)"
container="revisit-admission-test-$$"
trap 'docker stop "$container" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --network none --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
# The temporary initialization server only accepts Unix-socket connections.
# Wait for TCP so the readiness check cannot pass before that server restarts.
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  if [[ $attempt -eq 30 ]]; then exit 1; fi
  sleep 1
done
docker cp "$support_dir" "$container:/tmp/revisit-sql"
docker exec "$container" psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 -f /tmp/revisit-sql/tests/admission-fence.spec.sql
