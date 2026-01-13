-- CreateTable
CREATE TABLE "IntraGroup" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "IntraGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntraGroupUser" (
    "id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "IntraGroupUser_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IntraGroupUser" ADD CONSTRAINT "IntraGroupUser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "IntraUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntraGroupUser" ADD CONSTRAINT "IntraGroupUser_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "IntraGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
