#!/usr/bin/env bash

set -euo pipefail

DEFAULT_PROJECT_ID="revisit-utah"
DEFAULT_STORAGE_BUCKET="revisit-utah.appspot.com"
DEFAULT_DATABASE_ID="(default)"
DEFAULT_GLOBAL_CONFIG="public/global.json"

PROJECT_ID="${FIREBASE_PROJECT_ID:-$DEFAULT_PROJECT_ID}"
STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET:-$DEFAULT_STORAGE_BUCKET}"
DATABASE_ID="${FIRESTORE_DATABASE_ID:-$DEFAULT_DATABASE_ID}"
GLOBAL_CONFIG="$DEFAULT_GLOBAL_CONFIG"
STORAGE_BACKEND="${STORAGE_BACKEND:-gcloud}"
S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-}"
JOBS="${CLEAR_OUT_FIREBASE_JOBS:-4}"
DRY_RUN=1
INCLUDE_SNAPSHOTS=1
DISCOVER_FIRESTORE=1
STUDY_FILTER_SET=0
ACTIVE_TASKS=0
PARALLEL_FAILURES=0
COLOR_ENABLED=0
COLOR_RESET=""
COLOR_BLUE=""
COLOR_GREEN=""
COLOR_RED=""
COLOR_YELLOW=""

PREFIXES=("prod-")
STUDIES=()
EXTRA_FIRESTORE_COLLECTIONS=()

usage() {
  cat <<'EOF'
Usage:
  scripts/clear-out-firebase.sh [options]

Deletes study data from the Firebase project used by the main reVISit deployment.
It preserves the Firestore user-management collection.

By default this is a dry run. Destructive cleanup requires:
  --execute

Options:
  --project PROJECT_ID       Firebase project ID. Default: revisit-utah
  --bucket BUCKET            Storage bucket. Default: revisit-utah.appspot.com
  --database DATABASE_ID     Firestore database ID. Default: (default)
  --global-config PATH       Global config to read study IDs from. Default: public/global.json
  --study STUDY_ID           Only delete one study ID. Can be repeated.
  --prefix PREFIX            Study collection/storage prefix. Default: prod-
  --include-dev              Also delete dev- prefixed study data.
  --collection COLLECTION    Additional Firestore collection to delete. Can be repeated.
  --discover-firestore      Discover matching top-level Firestore collections when executing. Default.
  --no-discover-firestore   Only delete derived and explicitly supplied Firestore collection names.
  --no-snapshots             Skip snapshot storage prefix cleanup.
  --storage-backend BACKEND  gcloud, aws, or none. Default: gcloud
  --s3-endpoint-url URL      Endpoint URL for --storage-backend aws.
  --jobs N                   Maximum parallel deletes per phase. Default: 4.
  --execute                  Perform deletes instead of printing commands.
  -h, --help                 Show this help.

Examples:
  scripts/clear-out-firebase.sh
  scripts/clear-out-firebase.sh --study demo-html-input
  scripts/clear-out-firebase.sh --execute

Notes:
  Firestore cleanup uses firebase firestore:delete.
  Storage cleanup uses the selected object-storage CLI because Firebase CLI does
  not provide the same recursive object cleanup command for Firebase Storage.
EOF
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

append_unique() {
  local value="$1"
  shift
  local existing
  for existing in "$@"; do
    if [[ "$existing" == "$value" ]]; then
      return 1
    fi
  done
  return 0
}

array_contains() {
  local value="$1"
  shift
  local existing
  for existing in "$@"; do
    if [[ "$existing" == "$value" ]]; then
      return 0
    fi
  done
  return 1
}

setup_colors() {
  if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
    COLOR_ENABLED=1
    COLOR_RESET=$'\033[0m'
    COLOR_BLUE=$'\033[34m'
    COLOR_GREEN=$'\033[32m'
    COLOR_RED=$'\033[31m'
    COLOR_YELLOW=$'\033[33m'
  fi
}

status_line() {
  local color="$1"
  local status="$2"
  local message="$3"

  if [[ "$COLOR_ENABLED" -eq 1 ]]; then
    printf '%s[%s]%s %s\n' "$color" "$status" "$COLOR_RESET" "$message"
  else
    printf '[%s] %s\n' "$status" "$message"
  fi
}

quote_command() {
  local part
  for part in "$@"; do
    printf '%q ' "$part"
  done
  printf '\n'
}

run_command() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run] '
    quote_command "$@"
    return 0
  fi

  printf '[run] '
  quote_command "$@"
  if "$@"; then
    return 0
  fi

  return 1
}

reset_parallel_state() {
  ACTIVE_TASKS=0
  PARALLEL_FAILURES=0
}

wait_for_one_task() {
  local status=0

  wait -n || status=$?
  if [[ "$status" -ne 0 ]]; then
    PARALLEL_FAILURES=$((PARALLEL_FAILURES + 1))
  fi
  ACTIVE_TASKS=$((ACTIVE_TASKS - 1))
}

wait_for_all_tasks() {
  while [[ "$ACTIVE_TASKS" -gt 0 ]]; do
    wait_for_one_task
  done
}

run_labeled_task() {
  local label="$1"
  shift

  status_line "$COLOR_BLUE" "start" "$label"
  if "$@"; then
    status_line "$COLOR_GREEN" "success" "$label"
    return 0
  fi

  status_line "$COLOR_RED" "error" "$label"
  return 1
}

start_task() {
  local label="$1"
  shift

  run_labeled_task "$label" "$@" &
  ACTIVE_TASKS=$((ACTIVE_TASKS + 1))

  if [[ "$ACTIVE_TASKS" -ge "$JOBS" ]]; then
    wait_for_one_task
  fi
}

load_studies_from_global_config() {
  [[ -f "$GLOBAL_CONFIG" ]] || die "global config not found: $GLOBAL_CONFIG"

  node -e '
const fs = require("fs");
const path = process.argv[1];
const config = JSON.parse(fs.readFileSync(path, "utf8"));
for (const studyId of config.configsList || []) {
  if (typeof studyId === "string" && studyId.length > 0) {
    console.log(studyId);
  }
}
' "$GLOBAL_CONFIG"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --project)
        PROJECT_ID="${2:-}"
        shift 2
        ;;
      --bucket)
        STORAGE_BUCKET="${2:-}"
        shift 2
        ;;
      --database)
        DATABASE_ID="${2:-}"
        shift 2
        ;;
      --global-config)
        GLOBAL_CONFIG="${2:-}"
        shift 2
        ;;
      --study)
        STUDIES+=("${2:-}")
        STUDY_FILTER_SET=1
        shift 2
        ;;
      --prefix)
        PREFIXES=("${2:-}")
        shift 2
        ;;
      --include-dev)
        if append_unique "dev-" "${PREFIXES[@]}"; then
          PREFIXES+=("dev-")
        fi
        shift
        ;;
      --collection)
        EXTRA_FIRESTORE_COLLECTIONS+=("${2:-}")
        shift 2
        ;;
      --discover-firestore)
        DISCOVER_FIRESTORE=1
        shift
        ;;
      --no-discover-firestore)
        DISCOVER_FIRESTORE=0
        shift
        ;;
      --no-snapshots)
        INCLUDE_SNAPSHOTS=0
        shift
        ;;
      --storage-backend)
        STORAGE_BACKEND="${2:-}"
        shift 2
        ;;
      --s3-endpoint-url)
        S3_ENDPOINT_URL="${2:-}"
        shift 2
        ;;
      --jobs)
        JOBS="${2:-}"
        shift 2
        ;;
      --execute)
        DRY_RUN=0
        shift
        ;;
      --force)
        printf '[warn] --force is deprecated; --execute is enough for destructive cleanup\n' >&2
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "unknown option: $1"
        ;;
    esac
  done
}

validate_args() {
  [[ -n "$PROJECT_ID" ]] || die "--project is required"
  [[ -n "$DATABASE_ID" ]] || die "--database is required"

  if [[ "$STORAGE_BACKEND" != "none" ]]; then
    [[ -n "$STORAGE_BUCKET" ]] || die "--bucket is required unless --storage-backend none is used"
  fi

  case "$STORAGE_BACKEND" in
    gcloud|aws|none)
      ;;
    *)
      die "--storage-backend must be one of: gcloud, aws, none"
      ;;
  esac

  if [[ ! "$JOBS" =~ ^[1-9][0-9]*$ ]]; then
    die "--jobs must be a positive integer"
  fi
}

require_commands() {
  command -v node >/dev/null 2>&1 || die "node is required to read $GLOBAL_CONFIG"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    return 0
  fi

  command -v firebase >/dev/null 2>&1 || die "firebase CLI is required"

  if [[ "$DISCOVER_FIRESTORE" -eq 1 ]]; then
    command -v gcloud >/dev/null 2>&1 || die "gcloud is required for Firestore collection discovery"
  fi

  case "$STORAGE_BACKEND" in
    gcloud)
      command -v gcloud >/dev/null 2>&1 || die "gcloud is required for storage cleanup"
      ;;
    aws)
      command -v aws >/dev/null 2>&1 || die "aws CLI is required for S3-compatible storage cleanup"
      ;;
    none)
      ;;
  esac
}

confirm_destructive_run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    return 0
  fi

  printf 'About to delete Firebase study data from project %s.\n' "$PROJECT_ID"
  printf 'Firestore user-management will be preserved.\n'
  printf 'Type delete to continue: '

  local confirmation
  read -r confirmation
  [[ "$confirmation" == "delete" ]] || die "confirmation did not match"
}

discover_firestore_collections() {
  local access_token
  access_token="$(gcloud auth print-access-token)"

  FIRESTORE_ACCESS_TOKEN="$access_token" node -e '
const https = require("https");

const [projectId, databaseId] = process.argv.slice(1);
const token = process.env.FIRESTORE_ACCESS_TOKEN;
const collectionIds = [];

async function listCollectionIds(pageToken) {
  const databasePath = encodeURIComponent(databaseId);
  const body = JSON.stringify({
    pageSize: 300,
    ...(pageToken ? { pageToken } : {}),
  });

  const requestOptions = {
    method: "POST",
    hostname: "firestore.googleapis.com",
    path: `/v1/projects/${projectId}/databases/${databasePath}/documents:listCollectionIds`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  const responseBody = await new Promise((resolve, reject) => {
    const request = https.request(requestOptions, (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        data += chunk;
      });
      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Firestore collection discovery failed with HTTP ${response.statusCode}: ${data}`));
          return;
        }
        resolve(data);
      });
    });

    request.on("error", reject);
    request.write(body);
    request.end();
  });

  const parsed = JSON.parse(responseBody);
  collectionIds.push(...(parsed.collectionIds || []));
  if (parsed.nextPageToken) {
    await listCollectionIds(parsed.nextPageToken);
  }
}

listCollectionIds().then(() => {
  collectionIds.sort().forEach((collectionId) => console.log(collectionId));
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
' "$PROJECT_ID" "$DATABASE_ID"
}

should_delete_discovered_collection() {
  local collection_name="$1"
  local prefix
  local study_id
  local target

  if [[ "$STUDY_FILTER_SET" -eq 0 && "$collection_name" == "_revisit" ]]; then
    return 0
  fi

  if [[ "$collection_name" == "user-management" ]]; then
    return 1
  fi

  for prefix in "${PREFIXES[@]}"; do
    if [[ "$STUDY_FILTER_SET" -eq 1 ]]; then
      for study_id in "${STUDIES[@]}"; do
        target="${prefix}${study_id}"
        if [[ "$collection_name" == "$target" ]]; then
          return 0
        fi
        if [[ "$INCLUDE_SNAPSHOTS" -eq 1 && "$collection_name" == "$target-snapshot-"* ]]; then
          return 0
        fi
      done
      continue
    fi

    if [[ "$collection_name" == "$prefix"* ]]; then
      return 0
    fi
  done

  return 1
}

build_firestore_collections() {
  local collection_name
  local prefix
  local study_id
  local target
  local collections=()

  if [[ "$STUDY_FILTER_SET" -eq 0 ]]; then
    collections+=("_revisit")
  fi

  for collection_name in "${EXTRA_FIRESTORE_COLLECTIONS[@]}"; do
    if ! array_contains "$collection_name" "${collections[@]}"; then
      collections+=("$collection_name")
    fi
  done

  for prefix in "${PREFIXES[@]}"; do
    for study_id in "${STUDIES[@]}"; do
      target="${prefix}${study_id}"
      if ! array_contains "$target" "${collections[@]}"; then
        collections+=("$target")
      fi
    done
  done

  if [[ "$DRY_RUN" -eq 0 && "$DISCOVER_FIRESTORE" -eq 1 ]]; then
    while IFS= read -r collection_name; do
      if should_delete_discovered_collection "$collection_name" \
        && ! array_contains "$collection_name" "${collections[@]}"; then
        collections+=("$collection_name")
      fi
    done < <(discover_firestore_collections)
  elif [[ "$DRY_RUN" -eq 1 && "$DISCOVER_FIRESTORE" -eq 1 ]]; then
    printf '[dry-run] skipping live Firestore collection discovery\n' >&2
  fi

  printf '%s\n' "${collections[@]}"
}

delete_firestore_collection() {
  local collection_name="$1"

  [[ "$collection_name" != "user-management" ]] || die "refusing to delete user-management"
  [[ -n "$collection_name" ]] || die "empty Firestore collection name"

  run_command \
    firebase \
    --project "$PROJECT_ID" \
    firestore:delete \
    --database "$DATABASE_ID" \
    --recursive \
    --force \
    "$collection_name"
}

gcloud_storage_url_has_matches() {
  local url="$1"

  gcloud storage ls "$url" >/dev/null 2>&1
}

delete_storage_prefix() {
  local prefix="$1"
  local storage_url

  [[ -n "$prefix" ]] || die "empty storage prefix"
  [[ "$prefix" != "user-management" ]] || die "refusing to delete user-management storage prefix"

  case "$STORAGE_BACKEND" in
    gcloud)
      storage_url="gs://$STORAGE_BUCKET/$prefix/**"
      if [[ "$DRY_RUN" -eq 0 ]] && ! gcloud_storage_url_has_matches "$storage_url"; then
        printf '[skip] storage prefix %s matched no objects\n' "$prefix"
        return 0
      fi
      run_command gcloud storage rm --recursive "$storage_url"
      ;;
    aws)
      if [[ "$prefix" == *'*'* ]]; then
        printf '[skip] aws storage backend cannot expand wildcard prefix %s\n' "$prefix"
        return 0
      fi

      if [[ -n "$S3_ENDPOINT_URL" ]]; then
        run_command aws s3 rm "s3://$STORAGE_BUCKET/$prefix/" --recursive --endpoint-url "$S3_ENDPOINT_URL"
      else
        run_command aws s3 rm "s3://$STORAGE_BUCKET/$prefix/" --recursive
      fi
      ;;
    none)
      printf '[skip] storage prefix %s\n' "$prefix"
      ;;
  esac
}

main() {
  setup_colors
  parse_args "$@"
  validate_args
  require_commands

  if [[ "${#STUDIES[@]}" -eq 0 ]]; then
    while IFS= read -r study_id; do
      STUDIES+=("$study_id")
    done < <(load_studies_from_global_config)
  fi

  printf 'Project: %s\n' "$PROJECT_ID"
  printf 'Firestore database: %s\n' "$DATABASE_ID"
  printf 'Storage backend: %s\n' "$STORAGE_BACKEND"
  if [[ "$STORAGE_BACKEND" != "none" ]]; then
    printf 'Storage bucket: %s\n' "$STORAGE_BUCKET"
  fi
  printf 'Mode: %s\n' "$([[ "$DRY_RUN" -eq 1 ]] && printf dry-run || printf execute)"
  printf 'Parallel jobs: %s\n' "$JOBS"
  printf 'Study count: %s\n' "${#STUDIES[@]}"

  confirm_destructive_run

  local prefix
  local study_id
  local target
  local collection_name
  local firestore_collections=()

  while IFS= read -r collection_name; do
    firestore_collections+=("$collection_name")
  done < <(build_firestore_collections)

  reset_parallel_state
  for collection_name in "${firestore_collections[@]}"; do
    start_task "firestore $collection_name" delete_firestore_collection "$collection_name"
  done
  wait_for_all_tasks

  if [[ "$PARALLEL_FAILURES" -gt 0 ]]; then
    die "$PARALLEL_FAILURES Firestore cleanup task(s) failed"
  fi

  reset_parallel_state
  for prefix in "${PREFIXES[@]}"; do
    for study_id in "${STUDIES[@]}"; do
      target="${prefix}${study_id}"
      start_task "storage $target" delete_storage_prefix "$target"

      if [[ "$INCLUDE_SNAPSHOTS" -eq 1 ]]; then
        start_task "storage ${target}-snapshot-*" delete_storage_prefix "${target}-snapshot-*"
      fi
    done
  done
  wait_for_all_tasks

  if [[ "$PARALLEL_FAILURES" -gt 0 ]]; then
    die "$PARALLEL_FAILURES storage cleanup task(s) failed"
  fi
}

main "$@"
