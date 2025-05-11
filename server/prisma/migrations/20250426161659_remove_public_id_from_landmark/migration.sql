/*
  Warnings:

  - You are about to drop the column `public_id` on the `Landmark` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Landmark` DROP COLUMN `public_id`,
    ADD COLUMN `price` INTEGER NOT NULL DEFAULT 0;
