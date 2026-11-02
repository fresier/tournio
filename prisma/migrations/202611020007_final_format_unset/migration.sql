-- Format de la phase de classement à choisir : vide à la création (le calendrier attend ce choix).
-- Les tournois existants gardent leur format.
ALTER TABLE "tournio"."tournament_rules"
  ALTER COLUMN "final_format" DROP NOT NULL,
  ALTER COLUMN "final_format" DROP DEFAULT,
  DROP CONSTRAINT "rules_final_format_valid",
  ADD CONSTRAINT "rules_final_format_valid" CHECK ("final_format" IS NULL OR "final_format" IN ('none', 'rank', 'cross', 'bracket'));
