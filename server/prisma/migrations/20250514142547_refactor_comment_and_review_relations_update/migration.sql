/*
  Warnings:

  - Added the required column `landmarkId` to the `Comment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Comment` DROP FOREIGN KEY `Comment_reviewId_fkey`;

-- DropIndex
DROP INDEX `Comment_reviewId_fkey` ON `Comment`;

-- AlterTable
ALTER TABLE `Comment` ADD COLUMN `landmarkId` INTEGER NOT NULL,
    MODIFY `reviewId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_landmarkId_fkey` FOREIGN KEY (`landmarkId`) REFERENCES `Landmark`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
