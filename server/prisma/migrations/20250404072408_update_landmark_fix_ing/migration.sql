/*
  Warnings:

  - You are about to drop the column `ing` on the `Landmark` table. All the data in the column will be lost.
  - Added the required column `Ing` to the `Landmark` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Landmark` DROP COLUMN `ing`,
    ADD COLUMN `Ing` DOUBLE NOT NULL;
