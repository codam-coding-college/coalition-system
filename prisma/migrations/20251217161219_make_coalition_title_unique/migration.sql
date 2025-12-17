/*
  Warnings:

  - A unique constraint covering the columns `[title]` on the table `CodamCoalitionTitle` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CodamCoalitionTitle_title_key" ON "CodamCoalitionTitle"("title");
