-- CreateTable
CREATE TABLE "IntraProject" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "description" TEXT,
    "exam" BOOLEAN NOT NULL,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL
);
