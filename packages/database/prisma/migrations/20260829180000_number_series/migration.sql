-- Order and invoice numbers were derived from max(...) + 1 over surviving rows,
-- which reused a number after a deletion, raced when two customers checked out
-- at the same moment, and broke permanently past 99,999 because the maximum was
-- found with a text sort ('CD-2026-99999' sorts above 'CD-2026-100000').
CREATE TABLE IF NOT EXISTS "NumberSeries" (
  "key"       TEXT NOT NULL,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NumberSeries_pkey" PRIMARY KEY ("key")
);

-- Seed from what already exists, or the first new number collides with an old
-- one. Numbers are parsed rather than sorted: the padded text sort is exactly
-- the thing being removed, so it must not be trusted here either.
INSERT INTO "NumberSeries" ("key", "lastValue", "updatedAt")
SELECT
  'order:' || split_part("orderNumber", '-', 2),
  MAX(CAST(split_part("orderNumber", '-', 3) AS INTEGER)),
  NOW()
FROM "Order"
WHERE "orderNumber" ~ '^CD-[0-9]{4}-[0-9]+$'
GROUP BY split_part("orderNumber", '-', 2)
ON CONFLICT ("key") DO UPDATE
  SET "lastValue" = GREATEST("NumberSeries"."lastValue", EXCLUDED."lastValue");

-- Invoice numbers are `<prefix>/<FY>/<n>`, where the prefix may itself contain
-- slashes, so the sequence is the last segment and the series is everything
-- before it.
INSERT INTO "NumberSeries" ("key", "lastValue", "updatedAt")
SELECT
  'invoice:' || regexp_replace("invoiceNumber", '/[^/]+$', ''),
  MAX(CAST(regexp_replace("invoiceNumber", '^.*/', '') AS INTEGER)),
  NOW()
FROM "Order"
WHERE "invoiceNumber" IS NOT NULL
  AND "invoiceNumber" ~ '/[0-9]+$'
GROUP BY regexp_replace("invoiceNumber", '/[^/]+$', '')
ON CONFLICT ("key") DO UPDATE
  SET "lastValue" = GREATEST("NumberSeries"."lastValue", EXCLUDED."lastValue");
