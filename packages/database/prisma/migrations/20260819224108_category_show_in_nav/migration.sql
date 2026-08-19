-- Which categories are promoted to the navigation bar.
--
-- The parent/child relation this was meant to accompany already existed —
-- Category.parentId, unused since the schema was written. Only the
-- merchandising flag was missing.
--
-- Defaults false, so nothing appears in the bar until somebody decides it
-- should.
ALTER TABLE "Category" ADD COLUMN "showInNav" BOOLEAN NOT NULL DEFAULT false;
