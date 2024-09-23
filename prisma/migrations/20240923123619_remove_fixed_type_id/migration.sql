/*
  Warnings:

  - The primary key for the `CodamCoalitionFixedType` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `CodamCoalitionFixedType` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CodamCoalitionFixedType" (
    "type" TEXT NOT NULL PRIMARY KEY,
    "point_amount" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CodamCoalitionFixedType" ("created_at", "point_amount", "type", "updated_at") SELECT "created_at", "point_amount", "type", "updated_at" FROM "CodamCoalitionFixedType";
DROP TABLE "CodamCoalitionFixedType";
ALTER TABLE "new_CodamCoalitionFixedType" RENAME TO "CodamCoalitionFixedType";
CREATE TABLE "new_CodamCoalitionScore" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "coalition_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "fixed_type_id" TEXT,
    "type_intra_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intra_score_id" INTEGER,
    CONSTRAINT "CodamCoalitionScore_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "CodamCoalition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CodamCoalitionScore_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "CodamUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CodamCoalitionScore_fixed_type_id_fkey" FOREIGN KEY ("fixed_type_id") REFERENCES "CodamCoalitionFixedType" ("type") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CodamCoalitionScore_intra_score_id_fkey" FOREIGN KEY ("intra_score_id") REFERENCES "IntraScore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CodamCoalitionScore" ("amount", "coalition_id", "created_at", "fixed_type_id", "id", "intra_score_id", "reason", "type_intra_id", "updated_at", "user_id") SELECT "amount", "coalition_id", "created_at", "fixed_type_id", "id", "intra_score_id", "reason", "type_intra_id", "updated_at", "user_id" FROM "CodamCoalitionScore";
DROP TABLE "CodamCoalitionScore";
ALTER TABLE "new_CodamCoalitionScore" RENAME TO "CodamCoalitionScore";
CREATE UNIQUE INDEX "CodamCoalitionScore_intra_score_id_key" ON "CodamCoalitionScore"("intra_score_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
