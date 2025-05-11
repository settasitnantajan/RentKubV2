-- AlterTable
ALTER TABLE `Booking` ADD COLUMN `checkInStatus` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `checkOutStatus` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `confirmStatus` BOOLEAN NOT NULL DEFAULT false;
