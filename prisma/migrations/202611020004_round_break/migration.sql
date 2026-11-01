-- Pause minimale avant chaque tour de la phase de classement (après les poules et entre les tours).
ALTER TABLE "tournio"."tournament_rules"
  ADD COLUMN "round_break_minutes" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "rules_round_break_valid" CHECK ("round_break_minutes" BETWEEN 0 AND 600);
