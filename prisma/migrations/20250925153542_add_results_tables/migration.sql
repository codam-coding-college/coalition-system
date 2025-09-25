-- CreateTable
CREATE TABLE "CodamCoalitionSeasonResult" (
    "id" SERIAL NOT NULL,
    "coalition_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "bloc_deadline_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodamCoalitionSeasonResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodamCoalitionUserResult" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "coalition_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "season_result_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodamCoalitionUserResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodamCoalitionRankingResult" (
    "id" SERIAL NOT NULL,
    "ranking_type" TEXT NOT NULL,
    "season_result_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CodamCoalitionRankingResult_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CodamCoalitionSeasonResult" ADD CONSTRAINT "CodamCoalitionSeasonResult_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "CodamCoalition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalitionSeasonResult" ADD CONSTRAINT "CodamCoalitionSeasonResult_bloc_deadline_id_fkey" FOREIGN KEY ("bloc_deadline_id") REFERENCES "IntraBlocDeadline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalitionUserResult" ADD CONSTRAINT "CodamCoalitionUserResult_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "CodamUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalitionUserResult" ADD CONSTRAINT "CodamCoalitionUserResult_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "CodamCoalition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalitionUserResult" ADD CONSTRAINT "CodamCoalitionUserResult_season_result_id_fkey" FOREIGN KEY ("season_result_id") REFERENCES "CodamCoalitionSeasonResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
