/*
  Warnings:

  - You are about to drop the `CoalitionFixedType` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CoalitionScore` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "CoalitionFixedType_type_key";

-- DropIndex
DROP INDEX "CoalitionScore_intra_score_id_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CoalitionFixedType";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CoalitionScore";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "CodamCoalitionFixedType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "point_amount" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CodamCoalitionScore" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "coalition_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fixed_type_id" INTEGER,
    "type_intra_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intra_score_id" INTEGER,
    CONSTRAINT "CodamCoalitionScore_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "CodamCoalition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CodamCoalitionScore_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "CodamUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CodamCoalitionScore_fixed_type_id_fkey" FOREIGN KEY ("fixed_type_id") REFERENCES "CodamCoalitionFixedType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CodamCoalitionScore_intra_score_id_fkey" FOREIGN KEY ("intra_score_id") REFERENCES "IntraScore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CodamCoalition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT,
    CONSTRAINT "CodamCoalition_id_fkey" FOREIGN KEY ("id") REFERENCES "IntraCoalition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CodamCoalition" ("description", "id") SELECT "description", "id" FROM "CodamCoalition";
DROP TABLE "CodamCoalition";
ALTER TABLE "new_CodamCoalition" RENAME TO "CodamCoalition";
CREATE TABLE "new_CodamCoalitionTestAnswer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "question_id" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "coalition_id" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CodamCoalitionTestAnswer_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "CodamCoalition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CodamCoalitionTestAnswer_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "CodamCoalitionTestQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CodamCoalitionTestAnswer" ("answer", "coalition_id", "id", "question_id", "weight") SELECT "answer", "coalition_id", "id", "question_id", "weight" FROM "CodamCoalitionTestAnswer";
DROP TABLE "CodamCoalitionTestAnswer";
ALTER TABLE "new_CodamCoalitionTestAnswer" RENAME TO "CodamCoalitionTestAnswer";
CREATE TABLE "new_CodamUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    CONSTRAINT "CodamUser_id_fkey" FOREIGN KEY ("id") REFERENCES "IntraUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CodamUser" ("id") SELECT "id" FROM "CodamUser";
DROP TABLE "CodamUser";
ALTER TABLE "new_CodamUser" RENAME TO "CodamUser";
CREATE TABLE "new_IntraBlocDeadline" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bloc_id" INTEGER NOT NULL,
    "coalition_id" INTEGER,
    "begin_at" DATETIME NOT NULL,
    "end_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "IntraBlocDeadline_bloc_id_fkey" FOREIGN KEY ("bloc_id") REFERENCES "IntraBloc" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntraBlocDeadline_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "IntraCoalition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_IntraBlocDeadline" ("begin_at", "bloc_id", "coalition_id", "created_at", "end_at", "id", "updated_at") SELECT "begin_at", "bloc_id", "coalition_id", "created_at", "end_at", "id", "updated_at" FROM "IntraBlocDeadline";
DROP TABLE "IntraBlocDeadline";
ALTER TABLE "new_IntraBlocDeadline" RENAME TO "IntraBlocDeadline";
CREATE TABLE "new_IntraCoalitionUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "coalition_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "IntraCoalitionUser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "IntraUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntraCoalitionUser_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "IntraCoalition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_IntraCoalitionUser" ("coalition_id", "created_at", "id", "rank", "score", "updated_at", "user_id") SELECT "coalition_id", "created_at", "id", "rank", "score", "updated_at", "user_id" FROM "IntraCoalitionUser";
DROP TABLE "IntraCoalitionUser";
ALTER TABLE "new_IntraCoalitionUser" RENAME TO "IntraCoalitionUser";
CREATE TABLE "new_IntraScore" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "coalition_id" INTEGER NOT NULL,
    "scoreable_id" INTEGER,
    "scoreable_type" TEXT,
    "coalitions_user_id" INTEGER NOT NULL,
    "calculation_id" INTEGER,
    "value" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "IntraScore_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "IntraCoalition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntraScore_coalitions_user_id_fkey" FOREIGN KEY ("coalitions_user_id") REFERENCES "IntraCoalitionUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_IntraScore" ("calculation_id", "coalition_id", "coalitions_user_id", "created_at", "id", "reason", "scoreable_id", "scoreable_type", "updated_at", "value") SELECT "calculation_id", "coalition_id", "coalitions_user_id", "created_at", "id", "reason", "scoreable_id", "scoreable_type", "updated_at", "value" FROM "IntraScore";
DROP TABLE "IntraScore";
ALTER TABLE "new_IntraScore" RENAME TO "IntraScore";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CodamCoalitionFixedType_type_key" ON "CodamCoalitionFixedType"("type");

-- CreateIndex
CREATE UNIQUE INDEX "CodamCoalitionScore_intra_score_id_key" ON "CodamCoalitionScore"("intra_score_id");
