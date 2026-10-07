# Self-hosted Supabase for reVISit

This directory contains the reVISit-specific setup and migration files. Obtain
the deployment bundle directly from **Supabase self-hosted/v0.8.2** (see
[UPSTREAM](UPSTREAM)), following the upstream manual installation below. Its
default Storage backend uses persistent local files; MinIO is not required.
For an existing deployment, follow [MIGRATION.md](MIGRATION.md) **before starting
this configuration**. Hosted Supabase deployments do not need this migration.

## First-time setup

Requirements: a Linux host with Git, Docker Engine, Docker Compose v2 or newer, OpenSSL,
and Node.js 16+ (the upstream key helper can use Docker instead). For server
resources and operating-system details, follow the
[upstream installation guide](https://supabase.com/docs/guides/self-hosting/docker).
The storage filesystem must support Linux extended attributes. Mac shared
folders in Docker Desktop may reject these attributes; use a Docker-managed
Linux volume for a local rehearsal and back it up separately. The pinned ARM64
Studio and postgres-meta images also crashed on our Apple Silicon Docker Desktop
host; their amd64 variants worked under emulation. Verify image startup on your
actual host before a migration.

Keep the deployment outside the reVISit checkout so application updates do not
replace its configuration or data. The upstream stack uses fixed container
names: run only one copy per Docker host, or deliberately isolate it.

1. From the parent directory where you want your new deployment, obtain the
   pinned upstream bundle. Replace `revisit_support` with the absolute path to
   this directory in your reVISit checkout:

   ```sh
   revisit_support=/absolute/path/to/revisit-study/supabase
   git clone --filter=blob:none --sparse --depth 1 --branch self-hosted/v0.8.2 \
     https://github.com/supabase/supabase.git supabase-upstream &&
   git -C supabase-upstream sparse-checkout set docker &&
   test "$(git -C supabase-upstream rev-parse HEAD)" = \
     564eab8ad7840b13324f68b1bfac074ef8d51c21 &&
   mkdir supabase-project &&
   cp -a supabase-upstream/docker/. supabase-project/ &&
   cd supabase-project
   ```

   These are upstream's manual installation steps with a sparse checkout and
   commit check. Subsequent deployment commands run from `supabase-project`.
   Create your private configuration and generate fresh secrets:

   ```sh
   cp .env.example .env
   sh utils/generate-keys.sh --update-env
   sh utils/add-new-auth-keys.sh --update-env
   printf 'ref=self-hosted/v0.8.2\n' > .supabase-version
   ```

   These helpers print secrets; keep their output private. Never commit `.env`.
   The second helper enables asymmetric signing in `docker-compose.yml` while
   retaining verification of legacy JWTs.

2. Edit `.env`:
   - Set `ENABLE_ANONYMOUS_USERS=true` for participant sessions.
   - Set `SUPABASE_PUBLIC_URL` to the Supabase base URL clients can reach
     (`http://localhost:8000` locally). Set `API_EXTERNAL_URL` to its Auth
     endpoint (`http://localhost:8000/auth/v1` locally), following the template.
   - Set `SITE_URL` and `ADDITIONAL_REDIRECT_URLS` for your reVISit application.
   - Review email confirmation and SMTP settings for Study Designer accounts.
     For GitHub OAuth, append `ENABLE_GITHUB_OAUTH=true`,
     `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_SECRET`, and
     `GITHUB_OAUTH_REDIRECT_URI` to `.env`, then copy and enable our override:

     ```sh
     cp "$revisit_support/docker-compose.github.yml" .
     sh run.sh config add github
     ```

     The redirect URI is
     `<SUPABASE_PUBLIC_URL>/auth/v1/callback`; register it in the GitHub OAuth app.
     See [upstream OAuth guidance](https://supabase.com/docs/guides/self-hosting/auth).
   - Keep `STORAGE_TENANT_ID=stub`, `GLOBAL_S3_BUCKET=stub`, and `REGION=stub`
     unless you have an existing deployment with different values.

3. Pull and start the stack:

   ```sh
   sh run.sh pull
   sh run.sh start
   sh run.sh status
   ```

   Open Studio at `http://localhost:8000` and use your generated
   `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD`. On a server, expose the API
   through HTTPS and restrict administration/database ports. The upstream
   pooler publishes ports 5432 and 6543; do not allow public access to them.
   Follow [upstream HTTPS guidance](https://supabase.com/docs/guides/self-hosting/self-hosted-proxy-https).

4. Initialize the reVISit table and private bucket **on a fresh database only**:

   ```sh
   docker exec -i supabase-db psql -U supabase_admin \
     -v ON_ERROR_STOP=1 < "$revisit_support/revisit.sql"
   ```

   `psql` uses the container's `PGDATABASE`, which upstream sets from
   `POSTGRES_DB`; this initializes the configured application database.
   This applies the same schema and access model as the existing
   [reVISit setup instructions](https://revisit.dev/docs/data-and-deployment/supabase/setup/).
   Those policies allow anyone holding the public application key to read and
   write reVISit records and objects. A private bucket prevents unauthenticated
   public URLs; it does **not** provide participant-level isolation under these
   policies. Keep your existing stricter policies when migrating. This upgrade
   does not redesign authorization.

5. Configure the `.env` at the root of your **reVISit application**:

   ```dotenv
   VITE_STORAGE_ENGINE="supabase"
   VITE_SUPABASE_URL="http://localhost:8000"
   VITE_SUPABASE_ANON_KEY="<SUPABASE_PUBLISHABLE_KEY from supabase/.env>"
   ```

   The application variable retains its existing name and accepts the new
   publishable key. Never put `SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` in
   application configuration. Restart `yarn serve` or rebuild/redeploy the app
   after changing these build-time variables.

6. Complete a short study, confirm its participant data in Studio, and restart
   Supabase. Confirm the original data still opens and another participant can
   submit answers. Exercise your configured Study Designer sign-in as well.

## Storage and ongoing operations

Files persist under `volumes/storage`; Postgres persists under `volumes/db/data`.
The `db-config` named volume contains encryption material and must also be backed
up. **Never use `docker compose down -v` on a deployment you intend to keep.**
Back up files and database together with writes paused, store backups outside
the server, test restores, and monitor disk capacity. File storage is suitable
for a single-server deployment; it does not replicate data or provide failover.
For deployments requiring object storage, use
[upstream S3 configuration](https://supabase.com/docs/guides/self-hosting/self-hosted-s3).

Use `sh run.sh stop`, `start`, `status`, and `logs` to operate the stack.
Before any update, verify external backups and move retained migration copies
`volumes/db/data.bak.pg15` and `volumes/storage.minio-backup` outside the deployment;
keep them for rollback. Also move or remove the disposable
`volumes/db/pg17_upgrade_bin_*.tar.gz` cache after accepting migration, while
retaining encryption/key backups. Upstream's configuration backup excludes only the exact
live-data paths, so these copies would be archived too, potentially filling the
disk. Archive errors only warn: check the resulting configuration archive before
relying on it, and stop if it is incomplete.

Review future tagged updates using `sh update.sh --dry-run --to <release-tag>`
and [upstream update guidance](https://supabase.com/docs/guides/self-hosting/updating).
The update tool belongs to the downloaded upstream bundle. Review its plan and
your GitHub override before applying an update; this guide and migration helper
target the pinned release above.

## Local regression checks

Run these checks from your reVISit checkout. The migration helper requires
Python 3.11+ and no third-party Python packages:

```sh
python3 supabase/tests/migrate-storage.spec.py
```

The opt-in Chromium test is `tests/supabase-live.spec.ts`. It needs an isolated
running stack, initialized `supabase/revisit.sql`, and the application's Supabase
environment variables. Set `PW_SUPABASE_LIVE=1` and
`PW_SUPABASE_SERVICE_ROLE_KEY` privately, then run the focused suite from the
repository root with `yarn exec playwright test tests/supabase-live.spec.ts --project chromium`.
Use `PW_SUPABASE_PARTICIPANT_ID` to retain a known UUID before migration and
`PW_SUPABASE_EXISTING_PARTICIPANT` to verify it afterwards. The test creates real
participant records; do not point it at production.
