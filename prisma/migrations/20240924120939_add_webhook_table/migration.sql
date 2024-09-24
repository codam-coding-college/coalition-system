-- CreateTable
CREATE TABLE "IntraWebhook" (
    "delivery_id" TEXT NOT NULL PRIMARY KEY,
    "model" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "received_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
