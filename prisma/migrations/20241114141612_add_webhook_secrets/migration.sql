-- CreateTable
CREATE TABLE "IntraWebhookSecret" (
    "model" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntraWebhookSecret_pkey" PRIMARY KEY ("model","event")
);
