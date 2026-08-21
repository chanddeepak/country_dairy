#!/usr/bin/env bash
#
# Check our catalogue feed against Shiprocket's documented contract before
# anybody at Shiprocket does.
#
# Their team reviews the feed first and sends it back if the shape is wrong —
# one merchant was told "Product id, Variant id and Collection id should be of
# data-type long instead of string" and had to go and fix it. That round trip
# costs days, and every check below is one we can run in seconds.
#
#   export SHIPROCKET_API_KEY=… SHIPROCKET_API_SECRET=…
#   scripts/shiprocket-validate.sh                      # local
#   API=https://country-dairy-api-dev.onrender.com/api scripts/shiprocket-validate.sh
#
set -euo pipefail

API="${API:-http://localhost:4000/api}"
: "${SHIPROCKET_API_KEY:?set SHIPROCKET_API_KEY}"
: "${SHIPROCKET_API_SECRET:?set SHIPROCKET_API_SECRET}"

DIGEST="$(printf '' | openssl dgst -sha256 -hmac "$SHIPROCKET_API_SECRET" -binary | base64)"
get() {
  curl -sS "$API/$1" -H "X-Api-Key: $SHIPROCKET_API_KEY" -H "X-Api-HMAC-SHA256: $DIGEST"
}

echo "Validating $API"
echo

PRODUCTS="$(get 'shiprocket/products?page=1&limit=100')"
COLLECTIONS="$(get 'shiprocket/collections?page=1&limit=100')"

PRODUCTS="$PRODUCTS" COLLECTIONS="$COLLECTIONS" API="$API" \
KEY="$SHIPROCKET_API_KEY" DIGEST="$DIGEST" python3 - <<'PY'
import json, os, subprocess, sys

fails, warns = [], []
def check(ok, msg):
    print(('  PASS  ' if ok else '  FAIL  ') + msg)
    if not ok:
        fails.append(msg)

def warn(msg):
    print('  NOTE  ' + msg)
    warns.append(msg)

def load(name, raw):
    try:
        return json.loads(raw)
    except Exception:
        print(f'  FAIL  {name} did not return JSON — is the key right? First bytes: {raw[:120]!r}')
        sys.exit(1)

products = load('products', os.environ['PRODUCTS'])['data']['products']
collections = load('collections', os.environ['COLLECTIONS'])['data']['collections']

print('Ids must be long, never strings — their stated requirement')
for p in products:
    check(isinstance(p['id'], int), f"product {p['id']} id is {type(p['id']).__name__}")
    for v in p['variants']:
        check(isinstance(v['id'], int), f"variant {v['id']} id is {type(v['id']).__name__}")
for c in collections:
    check(isinstance(c['id'], int), f"collection {c['id']} id is {type(c['id']).__name__}")

print()
print('Ids must be unique')
pids = [p['id'] for p in products]
vids = [v['id'] for p in products for v in p['variants']]
check(len(pids) == len(set(pids)), 'product ids are unique')
check(len(vids) == len(set(vids)), 'variant ids are unique')

print()
print('Every field their contract names is present')
PRODUCT_FIELDS = ['id','title','body_html','handle','vendor','product_type','tags',
                  'status','created_at','updated_at','image','options','variants']
VARIANT_FIELDS = ['id','title','price','compare_at_price','sku','quantity','taxable',
                  'option_values','grams','weight','weight_unit','image']
for p in products:
    missing = [f for f in PRODUCT_FIELDS if f not in p]
    check(not missing, f"product {p['id']} has every field" + (f" (missing {missing})" if missing else ''))
    for v in p['variants']:
        missing = [f for f in VARIANT_FIELDS if f not in v]
        check(not missing, f"variant {v['id']} has every field" + (f" (missing {missing})" if missing else ''))

print()
print('Shipping needs a real weight, and checkout needs a real price')
for p in products:
    for v in p['variants']:
        check(isinstance(v.get('grams'), (int, float)) and v['grams'] > 0,
              f"variant {v['id']} grams = {v.get('grams')}")
        try:
            ok_price = float(v['price']) > 0
        except (TypeError, ValueError):
            ok_price = False
        check(ok_price, f"variant {v['id']} price = {v.get('price')!r}")

print()
print('Images must be absolute, or their checkout shows nothing')
for p in products:
    src = (p.get('image') or {}).get('src') or ''
    if not src:
        warn(f"product {p['id']} has no image")
    else:
        check(src.startswith('http'), f"product {p['id']} image is absolute")

print()
print('Only live products, and no empty collections')
for p in products:
    check(str(p.get('status')).lower() in ('active', 'live'),
          f"product {p['id']} status = {p.get('status')}")

for c in collections:
    raw = subprocess.run(
        ['curl','-sS', f"{os.environ['API']}/shiprocket/collection-products?collection_id={c['id']}&page=1&limit=100",
         '-H', f"X-Api-Key: {os.environ['KEY']}", '-H', f"X-Api-HMAC-SHA256: {os.environ['DIGEST']}"],
        capture_output=True, text=True).stdout
    got = load(f"collection {c['id']}", raw)['data']['products']
    # The failure that hid for weeks: a shelf whose stock all sits on its types
    # returned nothing here while the storefront showed it full.
    check(len(got) > 0, f"collection {c['id']} ({c['title']}) returns {len(got)} product(s)")

print()
if fails:
    print(f"{len(fails)} problem(s) — do not send until these are fixed")
    sys.exit(1)
print(f"All checks passed" + (f", {len(warns)} note(s)" if warns else ''))
PY
