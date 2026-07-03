-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "description" TEXT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
