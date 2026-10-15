#!/bin/sh
set -eu

# Supabase CLI emits unformatted TypeScript and asks for oxfmt. Compare both
# the generated file and the committed file after the same pinned formatter
# and trailing-whitespace normalization, so whitespace-only drift does not
# fail the gate. Structural differences still show up in the diff.

if [ "$#" -lt 1 ]; then
  echo "usage: scripts/normalize-database-types.sh <file>..." >&2
  exit 2
fi

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npx --yes oxfmt@0.73.0 --config "$ROOT/scripts/oxfmt-database.json" "$@"

python3 - "$@" <<'PY'
import pathlib
import sys

for name in sys.argv[1:]:
    path = pathlib.Path(name)
    lines = [line.rstrip(" \t") for line in path.read_text().splitlines()]
    while lines and lines[-1] == "":
        lines.pop()
    path.write_text("\n".join(lines) + "\n")
PY
