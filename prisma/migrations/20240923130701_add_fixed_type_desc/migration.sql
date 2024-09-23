/*
  Warnings:

  - Added the required column `description` to the `CodamCoalitionFixedType` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CodamCoalitionFixedType" (
    "type" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "point_amount" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CodamCoalitionFixedType" ("created_at", "point_amount", "type", "updated_at") SELECT "created_at", "point_amount", "type", "updated_at" FROM "CodamCoalitionFixedType";
DROP TABLE "CodamCoalitionFixedType";
ALTER TABLE "new_CodamCoalitionFixedType" RENAME TO "CodamCoalitionFixedType";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
