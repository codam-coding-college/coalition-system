-- CreateTable
CREATE TABLE "IntraCursusUser" (
    "id" INTEGER NOT NULL,
    "cursus_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "begin_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "level" DOUBLE PRECISION NOT NULL,
    "grade" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntraCursusUser_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IntraCursusUser" ADD CONSTRAINT "IntraCursusUser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "IntraUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
