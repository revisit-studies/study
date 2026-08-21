#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 3 || $# -gt 4 ]]; then
  echo "Usage: $0 <publish-dir> <destination-dir> <pages-checkout> [publish-branch]" >&2
  exit 2
fi

publish_dir="$1"
destination_dir="$2"
pages_checkout="$3"
publish_branch="${4:-gh-pages}"

if [[ ! -d "$publish_dir" ]]; then
  echo "Publish directory does not exist: $publish_dir" >&2
  exit 2
fi

if [[ ! -d "$pages_checkout/.git" ]]; then
  echo "Pages checkout is not a Git worktree: $pages_checkout" >&2
  exit 2
fi

if [[ -n "$destination_dir" && "$destination_dir" != "dev" && ! "$destination_dir" =~ ^PR[0-9]+$ ]]; then
  echo "Unsupported Pages destination: $destination_dir" >&2
  exit 2
fi

publish_dir="$(cd "$publish_dir" && pwd -P)"
pages_checkout="$(cd "$pages_checkout" && pwd -P)"

git -C "$pages_checkout" config user.name "github-actions[bot]"
git -C "$pages_checkout" config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git -C "$pages_checkout" checkout --orphan pages-snapshot

if [[ -z "$destination_dir" ]]; then
  rsync -a --delete \
    --exclude='/.git/' \
    --exclude='/.nojekyll' \
    --exclude='/CNAME' \
    --exclude='/dev/' \
    --exclude='/PR[0-9]*/' \
    "$publish_dir/" "$pages_checkout/"
else
  destination_path="$pages_checkout/$destination_dir"
  mkdir -p "$destination_path"
  rsync -a --delete "$publish_dir/" "$destination_path/"
  rmdir "$destination_path" 2>/dev/null || true
fi

touch "$pages_checkout/.nojekyll"

git -C "$pages_checkout" add --all
git -C "$pages_checkout" commit -m "Deploy current GitHub Pages snapshot"
git -C "$pages_checkout" push --force origin "HEAD:$publish_branch"
