/*
  Warnings:

  - A unique constraint covering the columns `[reviewId]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `Review` DROP FOREIGN KEY `Review_profileId_fkey`;

-- DropIndex
DROP INDEX `Review_profileId_landmarkId_key` ON `Review`;

-- AlterTable
ALTER TABLE `Booking` ADD COLUMN `reviewId` INTEGER NULL,
    ADD COLUMN `reviewed` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Review` ADD COLUMN `text` VARCHAR(1000) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Booking_reviewId_key` ON `Booking`(`reviewId`);

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `Profile`(`clerkId`) ON DELETE RESTRICT ON UPDATE CASCADE;
