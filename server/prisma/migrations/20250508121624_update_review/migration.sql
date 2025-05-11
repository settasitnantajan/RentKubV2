/*
  Warnings:

  - You are about to drop the column `rating` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `Review` table. All the data in the column will be lost.
  - Added the required column `convenienceRating` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerSupportRating` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `overallRating` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `signalQualityRating` to the `Review` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Review` DROP COLUMN `rating`,
    DROP COLUMN `text`,
    ADD COLUMN `convenienceRating` INTEGER NOT NULL,
    ADD COLUMN `customerSupportRating` INTEGER NOT NULL,
    ADD COLUMN `overallRating` INTEGER NOT NULL,
    ADD COLUMN `signalQualityRating` INTEGER NOT NULL;
