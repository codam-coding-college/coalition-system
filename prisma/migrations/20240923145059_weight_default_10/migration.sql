-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CodamCoalitionTestAnswer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "question_id" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "coalition_id" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 10,
    CONSTRAINT "CodamCoalitionTestAnswer_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "CodamCoalition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CodamCoalitionTestAnswer_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "CodamCoalitionTestQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CodamCoalitionTestAnswer" ("answer", "coalition_id", "id", "question_id", "weight") SELECT "answer", "coalition_id", "id", "question_id", "weight" FROM "CodamCoalitionTestAnswer";
DROP TABLE "CodamCoalitionTestAnswer";
ALTER TABLE "new_CodamCoalitionTestAnswer" RENAME TO "CodamCoalitionTestAnswer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
