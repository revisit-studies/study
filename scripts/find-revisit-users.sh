#!/usr/bin/env bash

set -euo pipefail

CODE_SEARCH_API_URL="https://api.github.com/search/code"
REPO_SEARCH_API_URL="https://api.github.com/search/repositories"
FORKS_API_URL_BASE="https://api.github.com/repos"
PER_PAGE=100
MAX_PAGES=10
REQUEST_DELAY_SECONDS=2
OUTPUT_JSON=false
UPSTREAM_REPO="revisit-studies/study"
INCLUDE_FORKS=true

DEFAULT_CODE_QUERIES=(
  # Only searching for the communicate utility for now; other queries commented out.
  "\"revisitUtilities/revisit-communicate.js\""
  # "\"raw.githubusercontent.com/revisit-studies/study\" \"StudyConfigSchema.json\""
  # "\"raw.githubusercontent.com/revisit-studies/study\" \"LibraryConfigSchema.json\""
  # "\"raw.githubusercontent.com/revisit-studies/study\" \"GlobalConfigSchema.json\""
  # "\"Revisit.postAnswers\""
  # "\"Revisit.onDataReceive\""
  # "\"revisit.dev/study\" \"config.json\""
)

DEFAULT_REPO_QUERIES=(
  # Repository-level queries commented out to focus on the communicate utility
  # "\"revisit.dev/study\" in:readme"
  # "\"revisit-communicate.js\" in:readme"
  # "\"Revisit.postAnswers\" in:readme"
)

print_help() {
  cat <<'EOF'
Find repositories that appear to use ReVISit by searching GitHub code with curl.

Usage:
  scripts/find-revisit-users.sh [options]

Options:
  --query <q>       Add a GitHub code-search query. If set, defaults are replaced.
                    Repeat this flag for multiple queries.
  --repo-query <q>  Add a GitHub repository-search query. If set, defaults are replaced.
                    Repeat this flag for multiple queries.
  --upstream-repo <owner/name>
                    Upstream repo used to discover forks (default: revisit-studies/study)
  --no-forks        Disable fork discovery from --upstream-repo
  --max-pages <n>   Max pages to fetch per query (default: 10)
  --per-page <n>    Results per page, max 100 (default: 100)
  --delay <sec>     Delay between GitHub API requests in seconds (default: 2)
  --json            Output JSON array instead of plain text
  --help            Show help

Environment:
  GITHUB_TOKEN      Optional. Strongly recommended to avoid strict API rate limits.

Examples:
  scripts/find-revisit-users.sh
  scripts/find-revisit-users.sh --delay 3
  GITHUB_TOKEN=... scripts/find-revisit-users.sh --json
  scripts/find-revisit-users.sh --query '"revisit-communicate.js" "Revisit.onDataReceive"'
  scripts/find-revisit-users.sh --upstream-repo revisit-studies/study
EOF
}

CODE_QUERIES=()
REPO_QUERIES=()
REQUEST_COUNT=0

sleep_before_request() {
  if [[ "$REQUEST_COUNT" -gt 0 ]] && [[ "$REQUEST_DELAY_SECONDS" != "0" ]]; then
    sleep "$REQUEST_DELAY_SECONDS"
  fi
  REQUEST_COUNT=$((REQUEST_COUNT + 1))
}

api_error_message() {
  node -e '
    let body = "";
    process.stdin.on("data", (c) => { body += c; });
    process.stdin.on("end", () => {
      try {
        const json = JSON.parse(body);
        if (json && typeof json === "object" && !Array.isArray(json) && typeof json.message === "string" && !Array.isArray(json.items)) {
          process.stdout.write(json.message);
        }
      } catch (error) {
        process.stdout.write(`Unable to parse GitHub API response: ${error.message}`);
      }
    });
  '
}

search_items_count() {
  node -e '
    let body = "";
    process.stdin.on("data", (c) => { body += c; });
    process.stdin.on("end", () => {
      try {
        const json = JSON.parse(body);
        const items = Array.isArray(json.items) ? json.items : [];
        console.log(items.length);
      } catch {
        console.log(0);
      }
    });
  '
}

array_items_count() {
  node -e '
    let body = "";
    process.stdin.on("data", (c) => { body += c; });
    process.stdin.on("end", () => {
      try {
        const json = JSON.parse(body);
        const items = Array.isArray(json) ? json : [];
        console.log(items.length);
      } catch {
        console.log(0);
      }
    });
  '
}

extract_repo_names_from_code_search() {
  node -e '
    let body = "";
    process.stdin.on("data", (c) => { body += c; });
    process.stdin.on("end", () => {
      const json = JSON.parse(body);
      const items = Array.isArray(json.items) ? json.items : [];
      for (const item of items) {
        if (item && item.repository && item.repository.full_name) {
          console.log(item.repository.full_name);
        }
      }
    });
  '
}

extract_repo_names_from_repo_search() {
  node -e '
    let body = "";
    process.stdin.on("data", (c) => { body += c; });
    process.stdin.on("end", () => {
      const json = JSON.parse(body);
      const items = Array.isArray(json.items) ? json.items : [];
      for (const item of items) {
        if (item && item.full_name) {
          console.log(item.full_name);
        }
      }
    });
  '
}

extract_repo_names_from_forks() {
  node -e '
    let body = "";
    process.stdin.on("data", (c) => { body += c; });
    process.stdin.on("end", () => {
      const items = JSON.parse(body);
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (item && item.full_name) {
          console.log(item.full_name);
        }
      }
    });
  '
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --query)
      [[ $# -lt 2 ]] && { echo "Missing value for --query" >&2; exit 1; }
      CODE_QUERIES+=("$2")
      shift 2
      ;;
    --repo-query)
      [[ $# -lt 2 ]] && { echo "Missing value for --repo-query" >&2; exit 1; }
      REPO_QUERIES+=("$2")
      shift 2
      ;;
    --upstream-repo)
      [[ $# -lt 2 ]] && { echo "Missing value for --upstream-repo" >&2; exit 1; }
      UPSTREAM_REPO="$2"
      shift 2
      ;;
    --no-forks)
      INCLUDE_FORKS=false
      shift
      ;;
    --max-pages)
      [[ $# -lt 2 ]] && { echo "Missing value for --max-pages" >&2; exit 1; }
      MAX_PAGES="$2"
      shift 2
      ;;
    --per-page)
      [[ $# -lt 2 ]] && { echo "Missing value for --per-page" >&2; exit 1; }
      PER_PAGE="$2"
      shift 2
      ;;
    --delay)
      [[ $# -lt 2 ]] && { echo "Missing value for --delay" >&2; exit 1; }
      REQUEST_DELAY_SECONDS="$2"
      shift 2
      ;;
    --json)
      OUTPUT_JSON=true
      shift
      ;;
    --help|-h)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Run with --help for usage." >&2
      exit 1
      ;;
  esac
done

if ! [[ "$MAX_PAGES" =~ ^[0-9]+$ ]] || [[ "$MAX_PAGES" -lt 1 ]]; then
  echo "--max-pages must be a positive integer" >&2
  exit 1
fi

if ! [[ "$PER_PAGE" =~ ^[0-9]+$ ]] || [[ "$PER_PAGE" -lt 1 ]] || [[ "$PER_PAGE" -gt 100 ]]; then
  echo "--per-page must be an integer between 1 and 100" >&2
  exit 1
fi

if ! [[ "$REQUEST_DELAY_SECONDS" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "--delay must be a non-negative number" >&2
  exit 1
fi

if [[ ${#CODE_QUERIES[@]} -eq 0 ]]; then
  if [[ ${#DEFAULT_CODE_QUERIES[@]} -gt 0 ]]; then
    CODE_QUERIES=("${DEFAULT_CODE_QUERIES[@]}")
  else
    CODE_QUERIES=()
  fi
fi

if [[ ${#REPO_QUERIES[@]} -eq 0 ]]; then
  if [[ ${#DEFAULT_REPO_QUERIES[@]} -gt 0 ]]; then
    REPO_QUERIES=("${DEFAULT_REPO_QUERIES[@]}")
  else
    REPO_QUERIES=()
  fi
fi

curl_headers=(
  -H "Accept: application/vnd.github+json"
  -H "X-GitHub-Api-Version: 2022-11-28"
)
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  curl_headers+=(-H "Authorization: Bearer ${GITHUB_TOKEN}")
else
  echo "Warning: GITHUB_TOKEN is not set. You may hit strict rate limits." >&2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "This script requires node for JSON parsing." >&2
  exit 1
fi

tmp_repos_file="$(mktemp)"
cleanup() {
  rm -f "$tmp_repos_file"
}
trap cleanup EXIT

for query in "${CODE_QUERIES[@]}"; do
  echo "Searching code query: $query" >&2
  for ((page = 1; page <= MAX_PAGES; page += 1)); do
    sleep_before_request
    response="$(
      curl -fsSL --get \
        "${curl_headers[@]}" \
        --data-urlencode "q=${query}" \
        --data-urlencode "per_page=${PER_PAGE}" \
        --data-urlencode "page=${page}" \
        "${CODE_SEARCH_API_URL}"
    )"

    error_message="$(
      printf '%s' "$response" | api_error_message
    )"

    if [[ -n "$error_message" ]]; then
      echo "GitHub API error: $error_message" >&2
      exit 1
    fi

    item_count="$(
      printf '%s' "$response" | search_items_count
    )"

    printf '%s' "$response" | extract_repo_names_from_code_search >> "$tmp_repos_file"

    if [[ "$item_count" -lt "$PER_PAGE" ]]; then
      break
    fi
  done
done

if [[ ${#REPO_QUERIES[@]} -gt 0 ]]; then
  for query in "${REPO_QUERIES[@]}"; do
    echo "Searching repository query: $query" >&2
    for ((page = 1; page <= MAX_PAGES; page += 1)); do
    sleep_before_request
    response="$(
      curl -fsSL --get \
        "${curl_headers[@]}" \
        --data-urlencode "q=${query}" \
        --data-urlencode "per_page=${PER_PAGE}" \
        --data-urlencode "page=${page}" \
        "${REPO_SEARCH_API_URL}"
    )"

    error_message="$(
      printf '%s' "$response" | api_error_message
    )"

    if [[ -n "$error_message" ]]; then
      echo "GitHub API error: $error_message" >&2
      exit 1
    fi

    item_count="$(
      printf '%s' "$response" | search_items_count
    )"

    printf '%s' "$response" | extract_repo_names_from_repo_search >> "$tmp_repos_file"

    if [[ "$item_count" -lt "$PER_PAGE" ]]; then
      break
    fi
    done
  done
fi

if [[ "$INCLUDE_FORKS" == true ]]; then
  echo "Searching forks of: $UPSTREAM_REPO" >&2
  for ((page = 1; page <= MAX_PAGES; page += 1)); do
    sleep_before_request
    response="$(
      curl -fsSL --get \
        "${curl_headers[@]}" \
        --data-urlencode "per_page=${PER_PAGE}" \
        --data-urlencode "page=${page}" \
        "${FORKS_API_URL_BASE}/${UPSTREAM_REPO}/forks"
    )"

    error_message="$(
      printf '%s' "$response" | api_error_message
    )"

    if [[ -n "$error_message" ]]; then
      echo "GitHub API error: $error_message" >&2
      exit 1
    fi

    item_count="$(
      printf '%s' "$response" | array_items_count
    )"

    printf '%s' "$response" | extract_repo_names_from_forks >> "$tmp_repos_file"

    if [[ "$item_count" -lt "$PER_PAGE" ]]; then
      break
    fi
  done
fi

if [[ ! -s "$tmp_repos_file" ]]; then
  echo "No repositories found."
  exit 0
fi

sorted_unique_repos="$(sort -u "$tmp_repos_file")"

if [[ "$OUTPUT_JSON" == true ]]; then
  printf '%s\n' "$sorted_unique_repos" | node -e '
    let body = "";
    process.stdin.on("data", (c) => { body += c; });
    process.stdin.on("end", () => {
      const repos = body.split(/\r?\n/).filter(Boolean);
      process.stdout.write(`${JSON.stringify(repos, null, 2)}\n`);
    });
  '
else
  printf '%s\n' "$sorted_unique_repos"
fi
