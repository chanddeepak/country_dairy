#!/bin/sh
#
# What would `migrate deploy` do to a database? Read-only.
#
# Run this before pointing a deploy at an environment for the first time. It
# writes nothing and changes nothing — it only reports two things:
#
#   1. whether the database has a Prisma migration history at all, and
#   2. the exact SQL that would be needed to bring it up to the current schema.
#
# Why it exists: the production database was created with `db push`, which
# builds tables without recording a migration history. `migrate deploy` on such
# a database fails with P3005 ("the database schema is not empty"), because it
# has no way to know which of the migrations are already reflected there. The
# fix is to baseline it first — see docs/deployment.md — and this tells you
# what to baseline it to.
#
# Usage, with the direct (port 5432) connection string, NOT the pooled one:
#
#   DIRECT_URL='postgresql://…:5432/postgres' sh scripts/check-prod-schema.sh
#
# Pass it in the environment rather than as an argument so the credential does
# not land in your shell history or in the process list.
set -e

if [ -z "${DIRECT_URL}" ]; then
  echo "Set DIRECT_URL to the direct (5432) connection string of the database to inspect."
  echo "Example: DIRECT_URL='postgresql://…' sh scripts/check-prod-schema.sh"
  exit 1
fi

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SCHEMA="${ROOT}/packages/database/prisma/schema.prisma"

echo "== Migration history =="
# A database that has been through `migrate deploy` has this table. One built
# by `db push` does not, and that is the whole problem this script exists to
# surface.
if npx --yes prisma db execute --url "${DIRECT_URL}" \
     --stdin <<'SQL' >/dev/null 2>&1
SELECT 1 FROM "_prisma_migrations" LIMIT 1;
SQL
then
  echo "  _prisma_migrations exists — this database has a migration history."
  echo "  'migrate deploy' can be run against it normally."
else
  echo "  NO _prisma_migrations table."
  echo "  'migrate deploy' will FAIL here with P3005 until the database is"
  echo "  baselined. See docs/deployment.md, 'Baselining a db push database'."
fi

echo
echo "== What the current schema would add =="
# Empty output means the database already matches the schema, so baselining it
# against every migration is safe. Any output means it is behind, and only the
# migrations it genuinely contains may be marked as applied.
npx --yes prisma migrate diff \
  --from-url "${DIRECT_URL}" \
  --to-schema-datamodel "${SCHEMA}" \
  --script

echo
echo "== Reminder =="
echo "  Nothing above was applied. This script only reads."
