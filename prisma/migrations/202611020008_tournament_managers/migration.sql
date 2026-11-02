CREATE TABLE "tournio"."tournament_managers" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tournament_managers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tournament_managers_email_normalized" CHECK ("email" = lower(btrim("email")) AND length("email") > 0),
    CONSTRAINT "tournament_managers_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournio"."tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "tournament_managers_tournament_id_email_key" ON "tournio"."tournament_managers"("tournament_id", "email");
CREATE INDEX "tournament_managers_email_idx" ON "tournio"."tournament_managers"("email");
