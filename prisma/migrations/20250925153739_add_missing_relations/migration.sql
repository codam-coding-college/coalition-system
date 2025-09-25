-- AddForeignKey
ALTER TABLE "CodamCoalitionRankingResult" ADD CONSTRAINT "CodamCoalitionRankingResult_ranking_type_fkey" FOREIGN KEY ("ranking_type") REFERENCES "CodamCoalitionRanking"("type") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalitionRankingResult" ADD CONSTRAINT "CodamCoalitionRankingResult_season_result_id_fkey" FOREIGN KEY ("season_result_id") REFERENCES "CodamCoalitionSeasonResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
