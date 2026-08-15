#!/bin/sh
#
# Apply migrations, then start the API.
#
# Until this existed, nothing applied migrations to a deployed environment.
# The image ran `node apps/api/dist/main` and the schema was brought up to
# date by a person remembering to do it by hand. That worked until it didn't:
# a deploy went out whose code expected a column the database did not have,
# and the failure surfaced as a 500 from an endpoint that looked unrelated.
#
# Running them here means the schema a build needs is applied by that build,
# in the same step, or the build does not serve at all.
set -e

SCHEMA="packages/database/prisma/schema.prisma"

if [ "${RUN_MIGRATIONS}" = "false" ]; then
  # An escape hatch for the case where a migration itself is what is broken:
  # without it a bad migration means a service that cannot boot and therefore
  # cannot be inspected. Loud on purpose — a process serving against a schema
  # it was not built for should never be a quiet condition.
  echo "WARNING: RUN_MIGRATIONS=false — starting WITHOUT applying migrations."
  echo "WARNING: the database schema may not match this build."
else
  echo "Applying database migrations…"
  # The local binary rather than npx: npx would try to fetch the CLI if it
  # were missing, and a container that reaches the network to repair itself
  # fails in a much more confusing way than one that simply stops.
  #
  # Prisma takes an advisory lock for the duration, so two instances starting
  # at once cannot both apply the same migration. It also uses directUrl,
  # which is why DIRECT_URL must point at the database directly rather than
  # through the connection pooler — migrations cannot run over pgbouncer in
  # transaction mode.
  ./node_modules/.bin/prisma migrate deploy --schema="${SCHEMA}"
  echo "Migrations applied."
fi

# exec, so the API becomes PID 1 and receives SIGTERM directly. Without it the
# shell holds PID 1, swallows the signal, and the platform's graceful shutdown
# becomes a kill after the timeout.
exec node apps/api/dist/main
