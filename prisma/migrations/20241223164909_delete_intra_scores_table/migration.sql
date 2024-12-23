/*
  Warnings:

  - You are about to drop the `IntraScore` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CodamCoalitionScore" DROP CONSTRAINT "CodamCoalitionScore_intra_score_id_fkey";

-- DropForeignKey
ALTER TABLE "IntraScore" DROP CONSTRAINT "IntraScore_coalition_id_fkey";

-- DropForeignKey
ALTER TABLE "IntraScore" DROP CONSTRAINT "IntraScore_coalitions_user_id_fkey";

-- DropTable
DROP TABLE "IntraScore";
