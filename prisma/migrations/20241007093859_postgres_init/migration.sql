-- CreateTable
CREATE TABLE "CodamUser" (
    "id" INTEGER NOT NULL,

    CONSTRAINT "CodamUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodamCoalition" (
    "id" INTEGER NOT NULL,
    "description" TEXT,

    CONSTRAINT "CodamCoalition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodamCoalitionFixedType" (
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "point_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodamCoalitionFixedType_pkey" PRIMARY KEY ("type")
);

-- CreateTable
CREATE TABLE "CodamCoalitionScore" (
    "id" SERIAL NOT NULL,
    "coalition_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "fixed_type_id" TEXT,
    "type_intra_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intra_score_id" INTEGER,

    CONSTRAINT "CodamCoalitionScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodamCoalitionTestSettings" (
    "id" INTEGER NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "deadline_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodamCoalitionTestSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodamCoalitionTestQuestion" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,

    CONSTRAINT "CodamCoalitionTestQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodamCoalitionTestAnswer" (
    "id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "coalition_id" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "CodamCoalitionTestAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntraUser" (
    "id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "usual_first_name" TEXT,
    "usual_full_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "image" TEXT,
    "pool_month" TEXT,
    "pool_year" TEXT,
    "anonymize_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntraUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntraBloc" (
    "id" INTEGER NOT NULL,
    "cursus_id" INTEGER NOT NULL,
    "squad_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntraBloc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntraBlocDeadline" (
    "id" INTEGER NOT NULL,
    "bloc_id" INTEGER NOT NULL,
    "coalition_id" INTEGER,
    "begin_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntraBlocDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntraCoalition" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image_url" TEXT,
    "color" TEXT,
    "score" INTEGER NOT NULL,
    "user_id" INTEGER,

    CONSTRAINT "IntraCoalition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntraCoalitionUser" (
    "id" INTEGER NOT NULL,
    "coalition_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntraCoalitionUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntraScore" (
    "id" INTEGER NOT NULL,
    "coalition_id" INTEGER NOT NULL,
    "scoreable_id" INTEGER,
    "scoreable_type" TEXT,
    "coalitions_user_id" INTEGER NOT NULL,
    "calculation_id" INTEGER,
    "value" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntraScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntraProject" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "difficulty" INTEGER,
    "description" TEXT,
    "exam" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntraProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntraWebhook" (
    "delivery_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handled_at" TIMESTAMP(3),

    CONSTRAINT "IntraWebhook_pkey" PRIMARY KEY ("delivery_id")
);

-- CreateTable
CREATE TABLE "_IntraBlocToIntraCoalition" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CodamCoalitionScore_intra_score_id_key" ON "CodamCoalitionScore"("intra_score_id");

-- CreateIndex
CREATE UNIQUE INDEX "_IntraBlocToIntraCoalition_AB_unique" ON "_IntraBlocToIntraCoalition"("A", "B");

-- CreateIndex
CREATE INDEX "_IntraBlocToIntraCoalition_B_index" ON "_IntraBlocToIntraCoalition"("B");

-- AddForeignKey
ALTER TABLE "CodamUser" ADD CONSTRAINT "CodamUser_id_fkey" FOREIGN KEY ("id") REFERENCES "IntraUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalition" ADD CONSTRAINT "CodamCoalition_id_fkey" FOREIGN KEY ("id") REFERENCES "IntraCoalition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalitionScore" ADD CONSTRAINT "CodamCoalitionScore_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "CodamCoalition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalitionScore" ADD CONSTRAINT "CodamCoalitionScore_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "CodamUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalitionScore" ADD CONSTRAINT "CodamCoalitionScore_fixed_type_id_fkey" FOREIGN KEY ("fixed_type_id") REFERENCES "CodamCoalitionFixedType"("type") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalitionScore" ADD CONSTRAINT "CodamCoalitionScore_intra_score_id_fkey" FOREIGN KEY ("intra_score_id") REFERENCES "IntraScore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalitionTestAnswer" ADD CONSTRAINT "CodamCoalitionTestAnswer_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "CodamCoalition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodamCoalitionTestAnswer" ADD CONSTRAINT "CodamCoalitionTestAnswer_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "CodamCoalitionTestQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntraBlocDeadline" ADD CONSTRAINT "IntraBlocDeadline_bloc_id_fkey" FOREIGN KEY ("bloc_id") REFERENCES "IntraBloc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntraBlocDeadline" ADD CONSTRAINT "IntraBlocDeadline_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "IntraCoalition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntraCoalitionUser" ADD CONSTRAINT "IntraCoalitionUser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "IntraUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntraCoalitionUser" ADD CONSTRAINT "IntraCoalitionUser_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "IntraCoalition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntraScore" ADD CONSTRAINT "IntraScore_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "IntraCoalition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntraScore" ADD CONSTRAINT "IntraScore_coalitions_user_id_fkey" FOREIGN KEY ("coalitions_user_id") REFERENCES "IntraCoalitionUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IntraBlocToIntraCoalition" ADD CONSTRAINT "_IntraBlocToIntraCoalition_A_fkey" FOREIGN KEY ("A") REFERENCES "IntraBloc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IntraBlocToIntraCoalition" ADD CONSTRAINT "_IntraBlocToIntraCoalition_B_fkey" FOREIGN KEY ("B") REFERENCES "IntraCoalition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
