#!/usr/bin/env bash
#
# Turn a markdown document into a .docx somebody outside the team can open.
#
# The handover documents are written in markdown because they live beside the
# code and change with it, but a vendor wants a Word file. Converting by hand
# means the two drift the moment anybody edits the markdown, so this exists to
# make regenerating cheap enough that nobody is tempted.
#
# Uses pandoc via pypandoc-binary, which bundles the pandoc executable — no
# system-wide install, and nothing to set up on a new machine beyond running
# this. The .docx imports into Google Docs with its tables intact.
#
#   scripts/md-to-docx.sh docs/checkout-and-identity.md
#   scripts/md-to-docx.sh docs/thing.md docs/Custom-Name.docx
#
set -euo pipefail

SRC="${1:?usage: scripts/md-to-docx.sh <input.md> [output.docx]}"
DEST="${2:-${SRC%.md}.docx}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$ROOT/.tooling/venv"

if [ ! -x "$VENV/bin/python" ]; then
  echo "Creating the docs toolchain (one time)…"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet pypandoc-binary
fi

"$VENV/bin/python" - "$SRC" "$DEST" <<'PY'
import sys
import pypandoc

src, dest = sys.argv[1], sys.argv[2]
# gfm rather than plain markdown: the tables in these documents are
# GitHub-flavoured, and the default reader renders them as literal pipes.
pypandoc.convert_file(src, 'docx', format='gfm', outputfile=dest,
                      extra_args=['--standalone'])
print(f'{src}  ->  {dest}')
PY
