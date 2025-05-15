/*
  Warnings:

  - You are about to drop the column `statusComment` on the `Comment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Comment` DROP COLUMN `statusComment`;

-- AlterTable
ALTER TABLE `Review` ADD COLUMN `statusComment` BOOLEAN NOT NULL DEFAULT false;
