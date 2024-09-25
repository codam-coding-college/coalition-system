/*
  Warnings:

  - Added the required column `status` to the `IntraWebhook` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IntraWebhook" (
    "delivery_id" TEXT NOT NULL PRIMARY KEY,
    "model" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "received_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_IntraWebhook" ("body", "delivery_id", "event", "model", "received_at") SELECT "body", "delivery_id", "event", "model", "received_at" FROM "IntraWebhook";
DROP TABLE "IntraWebhook";
ALTER TABLE "new_IntraWebhook" RENAME TO "IntraWebhook";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
