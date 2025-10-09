/*
  Warnings:

  - A unique constraint covering the columns `[season_result_id,ranking_type,user_id]` on the table `CodamCoalitionRankingResult` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[coalition_id,bloc_deadline_id]` on the table `CodamCoalitionSeasonResult` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[season_result_id,coalition_id,user_id]` on the table `CodamCoalitionUserResult` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CodamCoalitionRankingResult_season_result_id_ranking_type_u_key" ON "CodamCoalitionRankingResult"("season_result_id", "ranking_type", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "CodamCoalitionSeasonResult_coalition_id_bloc_deadline_id_key" ON "CodamCoalitionSeasonResult"("coalition_id", "bloc_deadline_id");

-- CreateIndex
CREATE UNIQUE INDEX "CodamCoalitionUserResult_season_result_id_coalition_id_user_key" ON "CodamCoalitionUserResult"("season_result_id", "coalition_id", "user_id");
