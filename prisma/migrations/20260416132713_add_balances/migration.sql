-- AlterTable
ALTER TABLE "_IntraBlocToIntraCoalition" ADD CONSTRAINT "_IntraBlocToIntraCoalition_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_IntraBlocToIntraCoalition_AB_unique";

-- CreateTable
CREATE TABLE "IntraBalance" (
    "id" INTEGER NOT NULL,
    "begin_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "pool_id" INTEGER NOT NULL,

    CONSTRAINT "IntraBalance_pkey" PRIMARY KEY ("id")
);
