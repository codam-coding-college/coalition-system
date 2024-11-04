-- AlterTable
ALTER TABLE "CodamCoalitionFixedType" ADD COLUMN     "ranking_type" TEXT;

-- CreateTable
CREATE TABLE "CodamCoalitionRanking" (
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "top_title" TEXT NOT NULL,
    "bonus_points" INTEGER,
    "disabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CodamCoalitionRanking_pkey" PRIMARY KEY ("type")
);

-- AddForeignKey
ALTER TABLE "CodamCoalitionFixedType" ADD CONSTRAINT "CodamCoalitionFixedType_ranking_type_fkey" FOREIGN KEY ("ranking_type") REFERENCES "CodamCoalitionRanking"("type") ON DELETE SET NULL ON UPDATE CASCADE;
