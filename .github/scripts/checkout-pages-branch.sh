#!/usr/bin/env bash
set -euo pipefail

pages_checkout="$1"
publish_branch="${2:-gh-pages}"

# Start from an authenticated checkout of the source branch. A fresh fork has
# no publishing branch yet; distinguish that from a remote/authentication error.
if git -C "$pages_checkout" ls-remote --exit-code --heads origin "$publish_branch" > /dev/null; then
  git -C "$pages_checkout" fetch --depth=1 origin "$publish_branch"
  git -C "$pages_checkout" checkout --detach FETCH_HEAD
else
  status=$?
  if [[ $status -ne 2 ]]; then exit "$status"; fi
  git -C "$pages_checkout" checkout --orphan pages-bootstrap
  git -C "$pages_checkout" rm -rf .
fi
