-- Horaires alignés : les matchs démarrent sur une grille commune à tous les terrains.
ALTER TABLE "tournio"."tournament_rules" ADD COLUMN "aligned_slots" BOOLEAN NOT NULL DEFAULT false;
