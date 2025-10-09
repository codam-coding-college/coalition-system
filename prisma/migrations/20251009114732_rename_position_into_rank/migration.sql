/*
  Warnings:

  - You are about to drop the column `position` on the `CodamCoalitionRankingResult` table. All the data in the column will be lost.
  - Added the required column `rank` to the `CodamCoalitionRankingResult` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CodamCoalitionRankingResult" DROP COLUMN "position",
ADD COLUMN     "rank" INTEGER NOT NULL;
