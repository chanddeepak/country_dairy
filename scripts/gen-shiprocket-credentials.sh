#!/usr/bin/env bash
#
# Generate the API key and secret Shiprocket's sync will present to us.
#
# We are the platform in the inbound direction, the way Shopify is for a
# Shopify merchant, so this pair is ours to issue. Run it yourself and paste
# the output straight into Render — never into a chat window, a ticket, or a
# commit.
#
#   scripts/gen-shiprocket-credentials.sh
#
set -euo pipefail

python3 - <<'PY'
import secrets
print('SHIPROCKET_API_KEY=cd_' + secrets.token_hex(16))
print('SHIPROCKET_API_SECRET=' + secrets.token_urlsafe(48))
PY

cat <<'TXT'

Next:
  1. Paste both into Render -> country-dairy-api-dev -> Environment, and redeploy.
  2. Send the same pair to Shiprocket through a secure channel, not email or chat.
  3. Confirm with:  API=https://country-dairy-api-dev.onrender.com/api \
       SHIPROCKET_API_KEY=... SHIPROCKET_API_SECRET=... scripts/shiprocket-feed.sh collections
TXT
