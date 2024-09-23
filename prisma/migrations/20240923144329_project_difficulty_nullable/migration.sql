-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IntraProject" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "difficulty" INTEGER,
    "description" TEXT,
    "exam" BOOLEAN NOT NULL,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_IntraProject" ("created_at", "description", "difficulty", "exam", "id", "name", "slug", "updated_at") SELECT "created_at", "description", "difficulty", "exam", "id", "name", "slug", "updated_at" FROM "IntraProject";
DROP TABLE "IntraProject";
ALTER TABLE "new_IntraProject" RENAME TO "IntraProject";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
