-- AlterTable
-- EmailLog has no rows yet (table just created in the prior migration), so
-- this can be a plain NOT NULL column with no backfill needed.
ALTER TABLE "EmailLog" ADD COLUMN "html" TEXT NOT NULL;
