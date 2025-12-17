-- CreateTable
CREATE TABLE "CodamCoalitionTitle" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "intra_title_id" INTEGER,
    "coalition_id" INTEGER NOT NULL,
    "ranking" INTEGER NOT NULL,

    CONSTRAINT "CodamCoalitionTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodamCoalitionTitleUser" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title_id" INTEGER NOT NULL,
    "intra_title_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodamCoalitionTitleUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CodamCoalitionTitle_intra_title_id_key" ON "CodamCoalitionTitle"("intra_title_id");

-- CreateIndex
CREATE UNIQUE INDEX "CodamCoalitionTitle_coalition_id_ranking_key" ON "CodamCoalitionTitle"("coalition_id", "ranking");

-- CreateIndex
CREATE UNIQUE INDEX "CodamCoalitionTitleUser_intra_title_user_id_key" ON "CodamCoalitionTitleUser"("intra_title_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "CodamCoalitionTitleUser_user_id_title_id_key" ON "CodamCoalitionTitleUser"("user_id", "title_id");

-- AddForeignKey
ALTER TABLE "CodamCoalitionTitle" ADD CONSTRAINT "CodamCoalitionTitle_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "CodamCoalition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalitionTitleUser" ADD CONSTRAINT "CodamCoalitionTitleUser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "CodamUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalitionTitleUser" ADD CONSTRAINT "CodamCoalitionTitleUser_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "CodamCoalitionTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
