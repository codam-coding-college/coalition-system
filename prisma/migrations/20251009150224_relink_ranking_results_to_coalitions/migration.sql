-- AlterTable
ALTER TABLE "CodamCoalitionRankingResult" ADD COLUMN     "coalition_id" INTEGER;

-- AddForeignKey
ALTER TABLE "CodamCoalitionRankingResult" ADD CONSTRAINT "CodamCoalitionRankingResult_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "CodamCoalition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
