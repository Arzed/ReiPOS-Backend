/*
  Warnings:

  - Added the required column `email` to the `Store` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `Store` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "pin" TEXT NOT NULL DEFAULT '123456',
    "whatsappNum" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Store" ("createdAt", "id", "name", "ownerName", "updatedAt", "whatsappNum") SELECT "createdAt", "id", "name", "ownerName", "updatedAt", "whatsappNum" FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
CREATE UNIQUE INDEX "Store_email_key" ON "Store"("email");
CREATE UNIQUE INDEX "Store_whatsappNum_key" ON "Store"("whatsappNum");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
