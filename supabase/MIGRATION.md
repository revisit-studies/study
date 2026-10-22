# Migrate the bundled MinIO or pgsty deployment

This procedure targets the previous bundled stack (Postgres 15.8.1.060,
Supabase Storage v1.11.13, and either the original MinIO images or `main`'s
`pgsty/silo` + `pgsty/mc` replacement images) and moves it to the release in
[UPSTREAM](UPSTREAM), using Postgres 17 and Storage v1.81.0's default file backend.
Auth uses the required upstream `v2.198.0-rc.25` override to include the eMudhra
TLS fix; keep it enabled after migration and container recreation. This is a
release candidate, selected because the pinned bundle's stable Auth predates the
fix. See [README.md](README.md) for the upstream security change.
Rehearse against a restored copy of your deployment first. New installations
use [README.md](README.md); hosted Supabase users are unaffected.

The database upgrade and storage move are separate steps in **one maintenance
window**. Storage object IDs, versions, owners, timestamps, bucket definitions,
and policies remain in Postgres. `migrate-storage.py` exports object bytes through
the old API and installs their versioned files with HTTP metadata in the new
backend. It never writes database records or re-uploads objects through the API.
Storage v1.81.0 itself applies one-way database migrations: after it starts, an
older Storage image cannot safely use that database. Rollback requires the
coordinated pre-upgrade database, object-store, encryption and configuration
backups below; changing image tags alone is insufficient.

Requirements: a Linux server, Git, Docker Compose, Bash, curl, rsync, OpenSSL, Python 3.11+,
root access for the upstream database upgrade, and sufficient free disk space.
Allow at least **three additional object-data copies** beyond the current
object store (physical backup, API export, and new file storage), plus **two
additional database copies** (external PG15 backup and PG17 data). Allow extra
space for filesystem/per-object metadata and a safety margin; measure the
existing on-disk directories rather than relying only on logical object sizes. Pre-pull the target images before
starting the upgrade; allow at least 15 GB additional temporary space for the
upgrade images, extracted binaries, and compressed bundle (also inside the
Docker VM when using Docker Desktop). The command below puts build files next
to the backup, avoiding a small or memory-backed `/tmp`. The destination
filesystem must support Linux extended attributes. Do not reuse MinIO's on-disk directory as
Supabase file storage. Custom S3 layouts, custom object-version separators, or
multiple Supabase stacks on one Docker host require a separately rehearsed plan.

## 1. Inventory and export while the old stack is running

Keep the old Compose/configuration files and images available for rollback.
Save the exact cached server/client images used by the old containers, including
the pgsty images when migrating `main`. Do not replace Silo with an old MinIO
image or change object-store versions during this migration.
Record your database extensions, OAuth/SMTP settings, proxy configuration,
bucket limits, storage tenant, backend bucket, and any custom access policies.
Restrict application traffic and pause participant/designer/background writes
for the remainder of the procedure. Keep Supabase accessible to the migration
operator until export finishes.

Obtain the new reVISit checkout separately; do not update the old deployment
in place before taking backups, because this change removes its bundled
configuration files. Copy `migrate-storage.py` from the new checkout to the
**old deployment directory**.
From that old directory, create a private backup outside the deployment:

```sh
umask 077
postgres_database=postgres # Set this to the existing .env POSTGRES_DB.
migration_backup="$(cd .. && pwd)/supabase-migration-backup"
mkdir "$migration_backup"
cp .env docker-compose.yml "$migration_backup/"
cp -a volumes/api "$migration_backup/api"
storage_server_image=$(docker inspect "$(docker compose ps -q minio)" \
  --format '{{.Image}}')
storage_client_image=$(docker inspect "$(docker compose ps -a -q minio-createbucket)" \
  --format '{{.Image}}')
test -n "$storage_server_image" && test -n "$storage_client_image" &&
docker image save "$storage_server_image" "$storage_client_image" \
  -o "$migration_backup/storage-images.tar" &&
cat > "$migration_backup/docker-compose.storage-images.yml" <<YAML
services:
  minio:
    image: $storage_server_image
  minio-createbucket:
    image: $storage_client_image
YAML
docker exec supabase-db pg_dumpall -U supabase_admin \
  > "$migration_backup/database.sql"
db_config_volume=$(docker inspect supabase-db --format \
  '{{range .Mounts}}{{if eq .Destination "/etc/postgresql-custom"}}{{.Name}}{{end}}{{end}}')
test -n "$db_config_volume"
printf '%s\n' "$db_config_volume" > "$migration_backup/db-config-volume"
docker inspect supabase-db --format \
  '{{index .Config.Labels "com.docker.compose.project"}}' \
  > "$migration_backup/compose-project"
docker run --rm -v "$db_config_volume:/source:ro" \
  -v "$migration_backup:/backup" \
  alpine:3.22 tar -cf /backup/db-config.tar -C /source .
```

Require every backup command to succeed before proceeding. The storage-image
archive and override use immutable IDs from the existing containers, so rollback
does not depend on mutable `latest` tags or registry availability. The bucket
setup container may be stopped; keep it until its image has been saved. If it
was already removed, resolve its original client image ID from your deployment
inventory and save it with the server image before continuing. The Compose
service names remain `minio` and `minio-createbucket` with the pgsty images.

Privately set `SUPABASE_SERVICE_ROLE_KEY` to the **old** `.env`'s `SERVICE_ROLE_KEY`
(for example, use `read -rs SUPABASE_SERVICE_ROLE_KEY` in Bash, then `export
SUPABASE_SERVICE_ROLE_KEY`; paste the key when prompted). Do not put the key in
shell history or in the application's `VITE_*` variables.

```sh
python3 migrate-storage.py export "$migration_backup/objects" \
  --url http://localhost:8000 --database "$postgres_database" &&
python3 migrate-storage.py check "$migration_backup/objects" \
  --bucket stub --tenant stub
```

Use your preserved `GLOBAL_S3_BUCKET` and `TENANT_ID` instead of `stub` for
`check` and installation. The check validates every export checksum and rejects
S3 keys that collide as file/directory paths, before any database upgrade. Such
a layout requires retaining an S3 backend with a separately rehearsed plan.
Export also refuses to publish a manifest if object metadata changes while it
runs; keep all writers paused and repeat into a new export directory.

Use your actual gateway URL and preserved `POSTGRES_DB` for both export and
verification. Keep `postgres_database` in the same shell session. Export includes
all live objects in every Supabase bucket, not only `revisit`, and fails on
missing objects, truncated HTTP responses, or size mismatches.
The export directory must not already exist. An interrupted export must be
repeated into a new directory; only a completed export contains `manifest.json`.
It does not copy orphaned MinIO objects absent from the database.

Snapshot the bundled application records, bucket settings, and access policies
while writes remain paused. Keep this private alongside the other backups:

```sh
cat > "$migration_backup/check-application.sql" <<'SQL'
SELECT json_build_object(
  'records', (SELECT json_agg(r ORDER BY "studyId", "docId") FROM public.revisit r),
  'buckets', (SELECT json_agg(b ORDER BY id) FROM (
    SELECT id, name, owner, owner_id, public, created_at, updated_at,
           file_size_limit, allowed_mime_types
    FROM storage.buckets
  ) b),
  'policies', (SELECT json_agg(p ORDER BY schemaname, tablename, policyname)
    FROM pg_policies p WHERE schemaname IN ('public', 'storage'))
);
SQL
docker exec -i supabase-db psql -U supabase_admin -d "$postgres_database" \
  -At -v ON_ERROR_STOP=1 < "$migration_backup/check-application.sql" \
  > "$migration_backup/application-before.json"
```

The final verification repeats this query and compares its output. Add separate
checks for any custom application tables, schemas, extensions, or encrypted data
identified in your inventory; the bundled snapshot does not certify those.

Stop the old stack **using its old Compose file**, without deleting volumes:

```sh
docker compose down
sudo cp -a volumes/db/data "$migration_backup/postgres15-data"
sudo cp -a volumes/storage "$migration_backup/minio-data"
```

Save the other deployment-specific configuration files as needed. Verify backup
completion before continuing. The physical database and encryption-volume
backups must belong to the same quiesced deployment.

## 2. Install the new configuration; preserve existing secrets

If this deployment is inside the old reVISit checkout, move the stopped directory
outside it after verifying the backups. Choose a destination that does not exist:

```sh
deployment=/absolute/path/to/supabase-project
test ! -e "$deployment"
sudo mv "$PWD" "$deployment"
cd "$deployment"
```

Skip the move if the deployment is already separate. Keep the same shell session
so `migration_backup` continues to refer to the original absolute backup path.
Application checkout updates must not replace deployment configuration or data.

Fetch the pinned official bundle into a separate source directory. From the
old deployment directory, replace the support path with your new reVISit checkout:

```sh
revisit_support=/absolute/path/to/new-checkout/supabase
git clone --filter=blob:none --sparse --depth 1 --branch self-hosted/v0.8.3 \
  https://github.com/supabase/supabase.git ../supabase-upstream &&
git -C ../supabase-upstream sparse-checkout set docker &&
test "$(git -C ../supabase-upstream rev-parse HEAD)" = \
  bc27d2661edd09a5d0b8d76ce33da6d4071a756e &&
rsync -av --exclude='.env' --exclude='.env.old' --exclude='.supabase-version' \
  --exclude='volumes/db/data*' --exclude='volumes/storage*' \
  ../supabase-upstream/docker/ ./ &&
cp "$revisit_support/docker-compose.auth.yml" . &&
cp "$revisit_support/docker-compose.github.yml" .
```

Do not add `--delete`. The command replaces files supplied by upstream; review
any local edits to those files before copying and carry them over deliberately.
Preserve the existing Compose project name and `db-config` named volume.
The upstream scripts now live in this deployment;
reVISit does not maintain copies of them.

Merge new `.env.example` settings into your existing private `.env`. Keep the
existing `POSTGRES_DB`, database password, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, and
encryption keys. **Do not run `generate-keys.sh` during migration:** rotating
these values can invalidate sessions or make encrypted data unreadable.

- Set `COMPOSE_FILE=docker-compose.yml` and `ENABLE_ANONYMOUS_USERS=true`.
- Carry the previous `TENANT_ID` into `STORAGE_TENANT_ID`; keep `GLOBAL_S3_BUCKET`
  and `REGION` consistent with the storage installation command below.
- Set the new gateway port `API_GW_HTTP_PORT` to your previous HTTP port.
- Supply newly required secrets such as `SECRET_KEY_BASE`, `REALTIME_DB_ENC_KEY`,
  `VAULT_ENC_KEY`, and `PG_META_CRYPTO_KEY` if absent. Also generate fresh
  `S3_PROTOCOL_ACCESS_KEY_ID` and `S3_PROTOCOL_ACCESS_KEY_SECRET` if missing;
  these secure Storage’s S3 API even when its backend is local files. Generate
  only missing values using the commands/lengths in `.env.example`; never use
  the template’s default secrets or credentials.
- Preserve `SITE_URL`, application redirects, SMTP, signup settings, and OAuth
  provider credentials. Convert `API_EXTERNAL_URL` to the full Auth endpoint:
  `https://your-domain` becomes `https://your-domain/auth/v1` (do not append the
  suffix twice). Keep the final `GITHUB_OAUTH_REDIRECT_URI` registered with
  GitHub unchanged at `https://your-domain/auth/v1/callback`. Any custom OAuth
  override derived from `${API_EXTERNAL_URL}/auth/v1/callback` must now use
  `${API_EXTERNAL_URL}/callback`. SAML deployments must update their IdP's ACS
  and metadata endpoints to `<base>/auth/v1/sso/saml/acs` and
  `<base>/auth/v1/sso/saml/metadata`. If configured, convert `SAML_EXTERNAL_URL`
  (mapped to `GOTRUE_SAML_EXTERNAL_URL`) to the full `/auth/v1` base too; it
  overrides `API_EXTERNAL_URL`. Re-fetch provider metadata afterwards. See
  [upstream Auth URL migration guidance](https://supabase.com/changelog/47093-self-hosted-supabase-api-external-url-to-include-auth-v1).
  The old GitHub settings are preserved by `sh run.sh config add github`. This optional
  override reads the existing `ENABLE_GITHUB_OAUTH`, `GITHUB_OAUTH_CLIENT_ID`,
  `GITHUB_OAUTH_SECRET`, and `GITHUB_OAUTH_REDIRECT_URI` variables. Keep the same
  callback URL and registered GitHub OAuth application.
- Keep legacy signing for this migration. Introducing asymmetric signing/key
  rotation is optional later; legacy keys are supported by the pinned stack.

Before modifying database files, pull the target images and check the two Node
services start on this host:

```sh
# Auth is required even if GitHub OAuth is disabled.
sh run.sh config add auth
# The existing ENABLE_GITHUB_OAUTH value controls whether GitHub sign-in is enabled.
sh run.sh config add github
sh run.sh pull
docker compose run --rm --no-deps studio node --version
docker compose run --rm --no-deps meta node --version
```

If either crashes, resolve host/image compatibility before upgrading.

Move the old MinIO data aside and create an empty file-storage directory:

```sh
mv volumes/storage volumes/storage.minio-backup
mkdir volumes/storage
sudo python3 - <<'PYTHON'
import os
from pathlib import Path
import tempfile
with tempfile.TemporaryDirectory(dir="volumes/storage") as temporary:
    probe = Path(temporary) / "xattr-probe"
    probe.write_bytes(b"storage preflight")
    os.setxattr(probe, "user.supabase.content-type", b"application/octet-stream")
    assert os.getxattr(probe, "user.supabase.content-type") == b"application/octet-stream"
PYTHON
```

Require the filesystem probe to succeed before upgrading the database. An
unsupported or unwritable filesystem must be fixed while the original database
and object-store backups are still untouched.

Do **not** apply `revisit.sql`: existing application schema, buckets, and policies
are retained by the database upgrade.

## 3. Upgrade Postgres using the upstream script

The upgrade script expects a running Postgres 15 container. Start **only the old
database** with the saved old configuration, pointing Compose at this deployment
directory so its relative paths still refer to the original data:

```sh
docker compose --project-directory "$PWD" \
  -f "$migration_backup/docker-compose.yml" up -d --wait db
docker exec supabase-db pg_isready -U postgres
# Our previous Compose did not initialize the upstream Realtime schema.
docker exec -i supabase-db psql -U supabase_admin -d "$postgres_database" \
  -v ON_ERROR_STOP=1 < volumes/db/realtime.sql
python3 "$revisit_support/prepare-pg17-upgrade.py" \
  utils/upgrade-pg17.sh "$migration_backup/upgrade-pg17.revisit.sh" &&
mkdir -p "$migration_backup/upgrade-tmp" &&
sudo env TMPDIR="$migration_backup/upgrade-tmp" \
  bash "$migration_backup/upgrade-pg17.revisit.sh" &&
sudo rmdir "$migration_backup/upgrade-tmp" &&
sh run.sh recreate auth
```

The preparation helper leaves the downloaded upstream script unchanged and
writes a deployment copy that selects the `db-config` volume actually mounted
by `supabase-db`, starts services using the saved Auth/GitHub overrides, and
aborts on a failed required SQL migration. It rejects an unexpected upstream
script before writing the prepared copy. Do not run the unprepared script:
it guesses the encryption volume, ignores saved overrides during startup, and
can report success after required migration errors. The final Auth recreation
and image check confirm the selected configuration. Keep traffic blocked
throughout; use `sh run.sh start` for normal operation rather than the original
script's printed commands.

Read all output, including migration warnings. This script uses upstream's
`pg_upgrade` procedure, preserves `data.bak.pg15` and the encryption key, applies
required role/extension changes, and starts the new stack. See
[upstream database upgrade guidance](https://supabase.com/docs/guides/self-hosting/postgres-upgrade-17).
The prepared script selects the running database's actual named encryption
volume even when unrelated or leftover `db-config` volumes exist. A missing
volume mount is an error; do not substitute another volume.

Require a successful script exit and healthy services.
**Upgrade complete is not sufficient:** the prepared copy stops on required
migration-file failures, but upstream extension reconciliation can still warn
and continue. Keep writes blocked and
**stop here** on missing migration files, SQL errors, or migration/extension
reconciliation failures. Resolve each failure and reapply only its affected SQL
from `/docker-entrypoint-initdb.d/migrations/` in the target database container
with `psql -v ON_ERROR_STOP=1`; inspect the pinned `utils/upgrade-pg17.sh` for the
required files and effects. Do not rerun the whole database upgrade: it refuses
an already upgraded database. Resolve startup failures or restore the preserved
backups to rehearse again.

The upstream script applies its database-local SQL to `postgres`. If your
`POSTGRES_DB` differs, separately rehearse and apply the required database-local
migrations there as well; the helper's database option does not adapt the
upstream upgrade script. Before proceeding, require the following role/grant
check to succeed in the configured application database, and confirm every
required migration completed without errors:

```sh
docker exec -i supabase-db psql -U supabase_admin -d "$postgres_database" \
  -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT (
    pg_has_role('postgres', 'supabase_privileged_role', 'MEMBER')
    AND pg_has_role('supabase_etl_admin', 'supabase_privileged_role', 'MEMBER')
    AND pg_has_role('supabase_etl_admin', 'pg_read_all_data', 'MEMBER')
    AND has_database_privilege('supabase_etl_admin', current_database(), 'CREATE')
    AND pg_has_role('supabase_etl_admin', 'pg_monitor', 'MEMBER')
    AND pg_has_role('supabase_read_only_user', 'pg_monitor', 'MEMBER')
    AND EXISTS (
      SELECT 1 FROM pg_auth_members m
      JOIN pg_roles granted ON granted.oid = m.roleid
      JOIN pg_roles member_role ON member_role.oid = m.member
      WHERE granted.rolname = 'pg_create_subscription'
        AND member_role.rolname = 'postgres' AND m.admin_option
    )
    AND has_function_privilege('postgres', 'pg_catalog.pg_reload_conf()',
                               'EXECUTE WITH GRANT OPTION')
  ) THEN
    RAISE EXCEPTION 'Required PG17 roles/grants missing; keep writes blocked';
  END IF;
END
$$;
SQL
```

A missing role or grant is a migration failure; resolve it before continuing.
These checks complement review of all migration output, including database-local
function/search-path, role settings, GraphQL trigger, and extension changes.

The target image changes the libc collation version. While traffic is still
blocked, rebuild indexes in each retained database. The block includes the
configured application database once; add any other retained databases to the
`set --` list:

```sh
(
  set -- postgres template1 _supabase
  case "$postgres_database" in
    postgres|template1|_supabase) ;;
    *) set -- "$@" "$postgres_database" ;;
  esac
  for database do
    docker exec -i supabase-db psql -U supabase_admin -d "$database" \
      -v ON_ERROR_STOP=1 -v database="$database" <<'SQL' || exit 1
REINDEX DATABASE :"database";
SQL
  done
)
```

Require this block to exit successfully for **every** database. On any failure,
stop, resolve the error, and rerun it before installing files or reopening writes.
The subshell stops at the first failed command without closing your login shell.

The upstream script refreshes the version marker; that alone does not rebuild
indexes. See [PostgreSQL collation guidance](https://www.postgresql.org/docs/17/sql-altercollation.html).
Allow time and temporary disk space for this step.

Keep application access blocked. Stop Storage and install exported files:

```sh
docker compose stop storage
sudo python3 migrate-storage.py install "$migration_backup/objects" \
  --destination volumes/storage --bucket stub --tenant stub
docker compose up -d storage
sh run.sh start
```

Replace `stub` with your preserved backend bucket and tenant values. The helper
checks all export hashes before writing, rejects unsafe paths/conflicting files,
and preserves Content-Type and Cache-Control using Linux extended attributes.
Installed directories use mode 755 and files 644 so the separate imgproxy user
can read them; restrict server access to this storage directory. Export backups
retain their private permissions.
Each payload and its HTTP metadata are staged on the destination filesystem
before an atomic rename, so a failed copy leaves the final object untouched.
It can be rerun with the same verified export after fixing an installation error.
A forcibly terminated process can leave `.revisit-migration-*` staging
directories beside its target objects. Once no migration process is running,
remove only those incomplete staging directories if they consume needed disk
space; preserve the exported backup and final object paths. Rerun installation
and verification before reopening writes.

## 4. Verify before reopening writes

```sh
docker exec -i supabase-db psql -U supabase_admin -d "$postgres_database" \
  -At -v ON_ERROR_STOP=1 < "$migration_backup/check-application.sql" \
  > "$migration_backup/application-after.json" &&
diff "$migration_backup/application-before.json" "$migration_backup/application-after.json" &&
python3 migrate-storage.py verify "$migration_backup/objects" \
  --url http://localhost:8000 --database "$postgres_database" &&
sh run.sh status &&
test "$(docker inspect supabase-auth --format '{{.Config.Image}}')" = \
  supabase/gotrue:v2.198.0-rc.25@sha256:b4c104aa7abbb2bc6c0c294072f736230979acfec87c9114fce63f4224e0f357 &&
docker exec supabase-db psql -U supabase_admin -d postgres \
  -c 'SHOW server_version;' &&
printf 'ref=self-hosted/v0.8.3\n' > .supabase-version
```

Require the entire verification block to succeed. Any unexplained record,
bucket, or policy difference must be resolved before reopening writes. Run
these comparisons before the smoke tests create new participant data. If the Auth image check
fails, keep writes blocked, enable the required Auth override, run
`sh run.sh recreate auth`, and repeat verification.

Verification streams every migrated object through the new API and checks its
SHA-256, Content-Type, and Cache-Control, plus the original database object
metadata. Keep the legacy application URL/key unchanged when possible. Check Study Designer login,
existing participants/answers/configurations, recordings, exports, access
policies, and a new participant submission. Restart the stack and confirm both
old and new data persist. Retain database/file/encryption backups and old images
until the deployment has been accepted. After verifying your external database/file/encryption backups and accepting
the migration, move `volumes/db/data.bak.pg15` and
`volumes/storage.minio-backup` outside the deployment (retain them for rollback).
Do this **before any upstream update**: its configuration archive excludes only
the exact live `data` and `storage` directories, includes these retained copies,
and can continue after archive errors. Keep their new locations in your rollback
inventory. Also move or remove the disposable `volumes/db/pg17_upgrade_bin_*.tar.gz`
cache after acceptance; it is also included in that archive and can exceed 1 GB.
Retain the encryption/key backups. Then reopen application writes.

## Rollback

Keep writes paused. Run the following in **Bash from the migrated deployment
directory**, using the same absolute `migration_backup` path as above. If using
a new shell, set that variable again first. The commands preserve the failed
deployment's data/configuration for diagnosis, then restore the coordinated
Postgres 15, MinIO/pgsty, and `db-config` backups. Restoring only database files
is insufficient: the upgrade also changes ownership/configuration in the
encryption volume.

The saved Compose project name preserves the original named-volume mapping,
even if the deployment directory was renamed. The volume name comes from the
original database container, rather than guessing a name. Restore any additional
custom configuration/overrides from your inventory before restarting.

```sh
(
set -eu
: "${migration_backup:?Set migration_backup to the original absolute backup path}"
db_config_volume=$(cat "$migration_backup/db-config-volume")
compose_project=$(cat "$migration_backup/compose-project")
test -n "$db_config_volume" && test -n "$compose_project"
test -d "$migration_backup/postgres15-data"
test -d "$migration_backup/minio-data"
test -f "$migration_backup/.env"
test -f "$migration_backup/docker-compose.yml"
test -d "$migration_backup/api"
tar -tf "$migration_backup/db-config.tar" > /dev/null
docker volume inspect "$db_config_volume" > /dev/null
docker image load -i "$migration_backup/storage-images.tar"

# Stop the upgraded stack with its current configuration. Never add -v.
docker compose --project-name "$compose_project" down
volume_users=$(docker ps -q --filter "volume=$db_config_volume")
if [ -n "$volume_users" ]; then
  echo 'db-config is still in use; stop leftover upgrade containers before restoring.' >&2
  exit 1
fi
umask 077
failed_upgrade="$migration_backup/failed-upgrade-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir "$failed_upgrade"
cp -a .env docker-compose.yml "$failed_upgrade/"
docker run --rm -v "$db_config_volume:/source:ro" \
  -v "$failed_upgrade:/backup" \
  alpine:3.22 tar -cf /backup/db-config.tar -C /source .
for directory in volumes/db/data volumes/storage volumes/api; do
  if [ -e "$directory" ]; then
    sudo mv "$directory" "$failed_upgrade/$(basename "$directory")"
  fi
done

sudo cp -a "$migration_backup/postgres15-data" volumes/db/data
sudo cp -a "$migration_backup/minio-data" volumes/storage
sudo cp -a "$migration_backup/api" volumes/api
cp "$migration_backup/.env" .env
cp "$migration_backup/docker-compose.yml" docker-compose.yml

# Remove PG17-only files, including hidden files, before restoring PG15's
# numeric ownership, permissions, encryption keys, and configuration.
docker run --rm -v "$db_config_volume:/restore" \
  -v "$migration_backup:/backup:ro" alpine:3.22 sh -ec '
    rm -rf /restore/* /restore/.[!.]* /restore/..?*
    tar -xpf /backup/db-config.tar -C /restore
  '

docker compose --project-name "$compose_project" -f docker-compose.yml \
  -f "$migration_backup/docker-compose.storage-images.yml" up -d --wait db
docker exec supabase-db psql -U supabase_admin -d postgres \
  -v ON_ERROR_STOP=1 -c 'SHOW server_version;'
docker compose --project-name "$compose_project" -f docker-compose.yml \
  -f "$migration_backup/docker-compose.storage-images.yml" up -d
)
```

The subshell stops on any failed command; do not restart services after a failed
restore. It restores the same pgsty or MinIO image IDs that were running before
migration. Once the Auth and Storage APIs are ready, verify the restored objects
with the old service-role key and gateway URL, using the original `POSTGRES_DB`:

```sh
docker exec -i supabase-db psql -U supabase_admin -d "$postgres_database" \
  -At -v ON_ERROR_STOP=1 < "$migration_backup/check-application.sql" \
  > "$migration_backup/application-restored.json" &&
diff "$migration_backup/application-before.json" "$migration_backup/application-restored.json" &&
python3 migrate-storage.py verify "$migration_backup/objects" \
  --url http://localhost:8000 --database "$postgres_database"
```

**Rollback also restores the old vulnerable Auth image.** Keep application
traffic blocked and GitHub OAuth/secure email unused until Auth is protected.
For the original bundled `v2.171.0` image, apply the certificate mitigation:

```sh
compose_project=$(cat "$migration_backup/compose-project")
docker compose --project-name "$compose_project" -f docker-compose.yml \
  exec -T --user root auth apk add --no-cache --upgrade \
  'ca-certificates>=20261020-r0' 'ca-certificates-bundle>=20261020-r0' &&
docker compose --project-name "$compose_project" -f docker-compose.yml restart auth
```

Require a successful package update and healthy Auth before testing sign-in.
This mitigation is discarded if the old Auth container is recreated; complete the fixed-image migration before
normal operation, or reapply the mitigation after every recreation. If your
Auth image or certificate mounts differ, verify a deployment-specific fix first.

Check existing participants/answers and Study Designer login before reopening
writes. Keep the failed-upgrade directory and original backups until rollback
has been accepted. These are local copies, not automatic off-host backups.

After new writes are accepted, restoring the old backups loses those writes.
Pause and plan how to retain them rather than treating rollback as lossless.
