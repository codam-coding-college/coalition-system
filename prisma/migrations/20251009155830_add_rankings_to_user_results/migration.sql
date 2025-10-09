/*
  Warnings:

  - Added the required column `coalition_rank` to the `CodamCoalitionUserResult` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CodamCoalitionUserResult" ADD COLUMN     "coalition_rank" INTEGER NOT NULL;
