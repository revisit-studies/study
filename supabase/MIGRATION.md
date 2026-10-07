# Migrate the bundled MinIO deployment

This procedure targets the previous bundled stack (Postgres 15.8.1.060,
Supabase Storage v1.11.13, and MinIO) and moves it to the release in [UPSTREAM](UPSTREAM),
using Postgres 17 and Storage v1.74.0's default file backend.
Rehearse against a restored copy of your deployment first. New installations
use [README.md](README.md); hosted Supabase users are unaffected.

The database upgrade and storage move are separate steps in **one maintenance
window**. Storage object IDs, versions, owners, timestamps, bucket definitions,
and policies remain in Postgres. `migrate-storage.py` exports object bytes through
the old API and installs their versioned files with HTTP metadata in the new
backend. It never writes database records or re-uploads objects through the API.

Requirements: a Linux server, Git, Docker Compose, Bash, curl, OpenSSL, Python 3.11+,
root access for the upstream database upgrade, and enough space for the database
backup/upgrade and two copies of object data. Pre-pull the target images before
starting the upgrade; allow at least 15 GB additional temporary space for the
upgrade images, extracted binaries, and compressed bundle (also inside the
Docker VM when using Docker Desktop). The destination filesystem must
support Linux extended attributes. Do not reuse MinIO's on-disk directory as
Supabase file storage. Custom S3 layouts, custom object-version separators, or
multiple Supabase stacks on one Docker host require a separately rehearsed plan.

## 1. Inventory and export while the old stack is running

Keep the old Compose/configuration files and images available for rollback.
Save cached MinIO server/client images if the registry can no longer supply them.
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
docker image save minio/minio minio/mc \
  -o "$migration_backup/minio-images.tar"
docker exec supabase-db pg_dumpall -U supabase_admin \
  > "$migration_backup/database.sql"
db_config_volume=$(docker inspect supabase-db --format \
  '{{range .Mounts}}{{if eq .Destination "/etc/postgresql-custom"}}{{.Name}}{{end}}{{end}}')
test -n "$db_config_volume"
docker run --rm -v "$db_config_volume:/source:ro" \
  -v "$migration_backup:/backup" \
  alpine:3.22 tar -cf /backup/db-config.tar -C /source .
```

Privately set `SUPABASE_SERVICE_ROLE_KEY` to the **old** `.env`'s `SERVICE_ROLE_KEY`
(for example, use `read -rs SUPABASE_SERVICE_ROLE_KEY` in Bash, then `export
SUPABASE_SERVICE_ROLE_KEY`; paste the key when prompted). Do not put the key in
shell history or in the application's `VITE_*` variables.

```sh
python3 migrate-storage.py export "$migration_backup/objects" \
  --url http://localhost:8000 --database "$postgres_database"
```

Use your actual gateway URL and preserved `POSTGRES_DB` for both export and
verification. Keep `postgres_database` in the same shell session. Export includes
all live objects in every Supabase bucket, not only `revisit`, and fails on missing objects or size mismatches.
The export directory must not already exist. An interrupted export must be
repeated into a new directory; only a completed export contains `manifest.json`.
It does not copy orphaned MinIO objects absent from the database.

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
git clone --filter=blob:none --sparse --depth 1 --branch self-hosted/v0.8.2 \
  https://github.com/supabase/supabase.git ../supabase-upstream &&
git -C ../supabase-upstream sparse-checkout set docker &&
test "$(git -C ../supabase-upstream rev-parse HEAD)" = \
  564eab8ad7840b13324f68b1bfac074ef8d51c21 &&
rsync -av --exclude='.env' --exclude='.env.old' --exclude='.supabase-version' \
  --exclude='volumes/db/data*' --exclude='volumes/storage*' \
  ../supabase-upstream/docker/ ./ &&
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
# The existing ENABLE_GITHUB_OAUTH value controls whether GitHub sign-in is enabled.
sh run.sh config add github
sh run.sh pull
docker compose run --rm --no-deps studio node --version
docker compose run --rm --no-deps meta node --version
```

If either crashes, resolve host/image compatibility before upgrading. Our ARM64
Docker Desktop rehearsal required the amd64 variants of these two images, as
noted in [README.md](README.md).

Move the old MinIO data aside and create an empty file-storage directory:

```sh
mv volumes/storage volumes/storage.minio-backup
mkdir volumes/storage
```

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
sudo bash utils/upgrade-pg17.sh
```

Read all output, including migration warnings. This script uses upstream's
`pg_upgrade` procedure, preserves `data.bak.pg15` and the encryption key, applies
required role/extension changes, and starts the new stack. See
[upstream database upgrade guidance](https://supabase.com/docs/guides/self-hosting/postgres-upgrade-17).
On a host with multiple `db-config` volumes, stop and resolve the target before
running: this upstream script selects a matching volume by name.

Require a successful script exit and healthy services.
**Upgrade complete is not sufficient:** the pinned script warns about failed
required SQL migrations and can still report success. Keep writes blocked and
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

## 4. Verify before reopening writes

```sh
python3 migrate-storage.py verify "$migration_backup/objects" \
  --url http://localhost:8000 --database "$postgres_database"
sh run.sh status
docker exec supabase-db psql -U supabase_admin -d postgres \
  -c 'SHOW server_version;'
printf 'ref=self-hosted/v0.8.2\n' > .supabase-version
```

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

While writes are still paused, stop the new stack without `-v`. Restore the saved
old Compose/API configuration and `.env`, the quiesced Postgres 15 data, the
MinIO directory, and the matching `db-config` encryption/configuration volume.
The database upgrade changes the volume's ownership/configuration, so restoring
only database files is insufficient. Use the physical backup and saved volume
archive (and load saved MinIO images with `docker image load -i`), or follow the
upstream rollback steps together with the original configuration. Start the old stack with the saved original images and verify
data and login before reopening writes. Keep the failed new data separately
for diagnosis.

After new writes are accepted, restoring the old backups loses those writes.
Pause and plan how to retain them rather than treating rollback as lossless.
