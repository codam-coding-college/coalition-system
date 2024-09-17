-- CreateTable
CREATE TABLE "CodamUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    CONSTRAINT "CodamUser_id_fkey" FOREIGN KEY ("id") REFERENCES "IntraUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodamCoalition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT,
    CONSTRAINT "CodamCoalition_id_fkey" FOREIGN KEY ("id") REFERENCES "IntraCoalition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoalitionFixedType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "point_amount" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CoalitionScore" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "coalition_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fixed_type_id" INTEGER,
    "type_intra_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intra_score_id" INTEGER,
    CONSTRAINT "CoalitionScore_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "CodamCoalition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CoalitionScore_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "CodamUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CoalitionScore_fixed_type_id_fkey" FOREIGN KEY ("fixed_type_id") REFERENCES "CoalitionFixedType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoalitionScore_intra_score_id_fkey" FOREIGN KEY ("intra_score_id") REFERENCES "IntraScore" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodamCoalitionTestQuestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "question" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CodamCoalitionTestAnswer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "question_id" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "coalition_id" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CodamCoalitionTestAnswer_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "CodamCoalition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CodamCoalitionTestAnswer_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "CodamCoalitionTestQuestion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntraUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "anonymize_date" DATETIME,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IntraBloc" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cursus_id" INTEGER NOT NULL,
    "squad_size" INTEGER,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IntraBlocDeadline" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bloc_id" INTEGER NOT NULL,
    "coalition_id" INTEGER,
    "begin_at" DATETIME NOT NULL,
    "end_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "IntraBlocDeadline_bloc_id_fkey" FOREIGN KEY ("bloc_id") REFERENCES "IntraBloc" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IntraBlocDeadline_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "IntraCoalition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntraCoalition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image_url" TEXT,
    "color" TEXT,
    "score" INTEGER NOT NULL,
    "user_id" INTEGER
);

-- CreateTable
CREATE TABLE "IntraCoalitionUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "coalition_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "IntraCoalitionUser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "IntraUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IntraCoalitionUser_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "IntraCoalition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntraScore" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "coalition_id" INTEGER NOT NULL,
    "scoreable_id" INTEGER,
    "scoreable_type" TEXT,
    "coalitions_user_id" INTEGER NOT NULL,
    "calculation_id" INTEGER,
    "value" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "IntraScore_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "IntraCoalition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IntraScore_coalitions_user_id_fkey" FOREIGN KEY ("coalitions_user_id") REFERENCES "IntraCoalitionUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_IntraBlocToIntraCoalition" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_IntraBlocToIntraCoalition_A_fkey" FOREIGN KEY ("A") REFERENCES "IntraBloc" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_IntraBlocToIntraCoalition_B_fkey" FOREIGN KEY ("B") REFERENCES "IntraCoalition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CoalitionFixedType_type_key" ON "CoalitionFixedType"("type");

-- CreateIndex
CREATE UNIQUE INDEX "CoalitionScore_intra_score_id_key" ON "CoalitionScore"("intra_score_id");

-- CreateIndex
CREATE UNIQUE INDEX "_IntraBlocToIntraCoalition_AB_unique" ON "_IntraBlocToIntraCoalition"("A", "B");

-- CreateIndex
CREATE INDEX "_IntraBlocToIntraCoalition_B_index" ON "_IntraBlocToIntraCoalition"("B");
