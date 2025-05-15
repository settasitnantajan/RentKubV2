/*
  Warnings:

  - You are about to drop the column `landmarkId` on the `Comment` table. All the data in the column will be lost.
  - Added the required column `reviewId` to the `Comment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Comment` DROP FOREIGN KEY `Comment_landmarkId_fkey`;

-- DropIndex
DROP INDEX `Comment_landmarkId_fkey` ON `Comment`;

-- AlterTable
ALTER TABLE `Comment` DROP COLUMN `landmarkId`,
    ADD COLUMN `reviewId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
