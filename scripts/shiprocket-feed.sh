#!/usr/bin/env bash
#
# Call our Shiprocket catalogue endpoints the way Shiprocket does.
#
# They cannot be opened in a browser: every request needs an API key and an
# HMAC of the body, and the address bar sends neither — so the guard answers
# 511 and Chrome shows a blank page. That is correct behaviour and it is also
# why this script exists.
#
# A GET has no body, so the digest is over the empty string. That is the part
# people get wrong by hand.
#
# Credentials come from the environment, never from an argument, so they stay
# out of shell history:
#
#   export SHIPROCKET_API_KEY=…            # from Render, for the dev API
#   export SHIPROCKET_API_SECRET=…
#   scripts/shiprocket-feed.sh products
#   scripts/shiprocket-feed.sh collections
#   scripts/shiprocket-feed.sh collection-products 1
#
# Defaults to localhost. For the deployed dev API:
#
#   API=https://country-dairy-api-dev.onrender.com/api scripts/shiprocket-feed.sh products
#
set -euo pipefail

API="${API:-http://localhost:4000/api}"
WHAT="${1:?usage: scripts/shiprocket-feed.sh <products|collections|collection-products [collection_id]>}"
COLLECTION_ID="${2:-}"

: "${SHIPROCKET_API_KEY:?set SHIPROCKET_API_KEY (do not paste it as an argument)}"
: "${SHIPROCKET_API_SECRET:?set SHIPROCKET_API_SECRET}"

case "$WHAT" in
  products)     PATH_AND_QUERY="shiprocket/products?page=1&limit=100" ;;
  collections)  PATH_AND_QUERY="shiprocket/collections?page=1&limit=100" ;;
  collection-products)
    : "${COLLECTION_ID:?collection-products needs a collection id}"
    PATH_AND_QUERY="shiprocket/collection-products?collection_id=${COLLECTION_ID}&page=1&limit=100"
    ;;
  *) echo "unknown: $WHAT" >&2; exit 2 ;;
esac

# The digest of an empty body, which is what every GET here is signed with.
DIGEST="$(printf '' | openssl dgst -sha256 -hmac "$SHIPROCKET_API_SECRET" -binary | base64)"

curl -sS "$API/$PATH_AND_QUERY" \
  -H "X-Api-Key: ${SHIPROCKET_API_KEY}" \
  -H "X-Api-HMAC-SHA256: $DIGEST" \
  -w '\n--- HTTP %{http_code} ---\n'
