-- AddForeignKey
ALTER TABLE "CodamCoalitionRankingResult" ADD CONSTRAINT "CodamCoalitionRankingResult_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "CodamUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
