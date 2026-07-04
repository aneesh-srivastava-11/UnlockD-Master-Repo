-- CreateTable
CREATE TABLE "RecurringSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "suggestedAmount" DECIMAL(19,4) NOT NULL,
    "categoryId" TEXT,
    "suggestedDate" TIMESTAMP(3) NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "linkedExpenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurringSuggestion_linkedExpenseId_key" ON "RecurringSuggestion"("linkedExpenseId");

-- AddForeignKey
ALTER TABLE "RecurringSuggestion" ADD CONSTRAINT "RecurringSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSuggestion" ADD CONSTRAINT "RecurringSuggestion_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSuggestion" ADD CONSTRAINT "RecurringSuggestion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSuggestion" ADD CONSTRAINT "RecurringSuggestion_linkedExpenseId_fkey" FOREIGN KEY ("linkedExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
