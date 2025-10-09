/*
  Warnings:

  - You are about to drop the column `season_result_id` on the `CodamCoalitionRankingResult` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[bloc_deadline_id,ranking_type,user_id]` on the table `CodamCoalitionRankingResult` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bloc_deadline_id` to the `CodamCoalitionRankingResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `coalition_id` to the `CodamCoalitionRankingResult` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CodamCoalitionRankingResult" DROP CONSTRAINT "CodamCoalitionRankingResult_season_result_id_fkey";

-- DropIndex
DROP INDEX "CodamCoalitionRankingResult_season_result_id_ranking_type_u_key";

-- AlterTable
ALTER TABLE "CodamCoalitionRankingResult" DROP COLUMN "season_result_id",
ADD COLUMN     "bloc_deadline_id" INTEGER NOT NULL,
ADD COLUMN     "coalition_id" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CodamCoalitionRankingResult_bloc_deadline_id_ranking_type_u_key" ON "CodamCoalitionRankingResult"("bloc_deadline_id", "ranking_type", "user_id");

-- AddForeignKey
ALTER TABLE "CodamCoalitionRankingResult" ADD CONSTRAINT "CodamCoalitionRankingResult_bloc_deadline_id_fkey" FOREIGN KEY ("bloc_deadline_id") REFERENCES "IntraBlocDeadline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
