-- AlterEnum: Remove WRAP from PrintSide
-- First check no rows reference WRAP
DELETE FROM "print_areas" WHERE "side" = 'WRAP';
DELETE FROM "design_sides" WHERE "side" = 'WRAP';

ALTER TYPE "PrintSide" RENAME TO "PrintSide_old";
CREATE TYPE "PrintSide" AS ENUM ('FRONT', 'BACK', 'LEFT_SLEEVE', 'RIGHT_SLEEVE');
ALTER TABLE "print_areas" ALTER COLUMN "side" TYPE "PrintSide" USING ("side"::text::"PrintSide");
ALTER TABLE "design_sides" ALTER COLUMN "side" TYPE "PrintSide" USING ("side"::text::"PrintSide");
DROP TYPE "PrintSide_old";

-- AlterTable: Add new columns to products
ALTER TABLE "products" ADD COLUMN "slug" TEXT;
ALTER TABLE "products" ADD COLUMN "description" TEXT;
ALTER TABLE "products" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Backfill slug from sku for existing rows
UPDATE "products" SET "slug" = LOWER(REPLACE("sku", '_', '-')) WHERE "slug" IS NULL;

-- Now make slug required and unique
ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- AlterTable: Add xPosition and yPosition to print_areas
ALTER TABLE "print_areas" ADD COLUMN "xPosition" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "print_areas" ADD COLUMN "yPosition" INTEGER NOT NULL DEFAULT 100;

-- CreateTable: product_colors
CREATE TABLE "product_colors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hexCode" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable: mockup_images
CREATE TABLE "mockup_images" (
    "id" TEXT NOT NULL,
    "side" "PrintSide" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "colorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mockup_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "product_colors" ADD CONSTRAINT "product_colors_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mockup_images" ADD CONSTRAINT "mockup_images_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "product_colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
