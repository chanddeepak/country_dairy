-- HeroBanner.imageHasText reached production without a migration, so the
-- migration folder could not rebuild the schema it describes. A fresh database
-- came up one column short and the seed failed on the first hero banner.
--
-- IF NOT EXISTS because production already has the column: this has to be a
-- no-op there and the fix everywhere else.
ALTER TABLE "HeroBanner" ADD COLUMN IF NOT EXISTS "imageHasText" BOOLEAN NOT NULL DEFAULT false;
