#!/usr/bin/env bash
# Cap the FastF1 cache size by deleting the least-recently-modified session data
# first. Each leaf directory holding .ff1pkl files is one cached session load;
# oldest sessions are removed until the cache is back under the cap. Safe to run
# while the server is up: a pruned session is simply re-fetched on next request.
set -euo pipefail

CACHE_DIR="${1:-${FASTF1_CACHE_DIR:-/var/lib/f1-replay/cache}}"
# The app nests its cache under a f1replaycache subfolder; prune that if present.
if [ -d "$CACHE_DIR/f1replaycache" ]; then
  CACHE_DIR="$CACHE_DIR/f1replaycache"
fi

MAX_GB="${CACHE_MAX_GB:-30}"
MAX_BYTES=$(( MAX_GB * 1024 * 1024 * 1024 ))

if [ ! -d "$CACHE_DIR" ]; then
  echo "cache dir $CACHE_DIR not found, nothing to prune"
  exit 0
fi

cur=$(du -sb "$CACHE_DIR" | cut -f1)
echo "cache size $(( cur / 1024 / 1024 )) MB, cap ${MAX_GB} GB"

# Session-data leaf dirs, oldest modification first (deduped, keeping the
# earliest appearance which corresponds to the oldest pickle in that dir).
mapfile -t leaves < <(
  find "$CACHE_DIR" -type f -name '*.ff1pkl' -printf '%T@ %h\n' \
    | sort -n | awk '{ $1=""; sub(/^ /,""); print }' | awk '!seen[$0]++'
)

i=0
while [ "$cur" -gt "$MAX_BYTES" ] && [ "$i" -lt "${#leaves[@]}" ]; do
  d="${leaves[$i]}"
  if [ -d "$d" ]; then
    sz=$(du -sb "$d" | cut -f1)
    rm -rf -- "$d"
    cur=$(( cur - sz ))
    echo "pruned $d"
  fi
  i=$(( i + 1 ))
done

echo "done, cache now ~$(( cur / 1024 / 1024 )) MB"
