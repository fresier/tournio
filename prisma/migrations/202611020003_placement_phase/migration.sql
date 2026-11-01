-- Phase de classement après les poules : format choisi dans les règles, matchs sans poule.

ALTER TABLE "tournio"."tournament_rules"
  ADD COLUMN "final_format" VARCHAR(10) NOT NULL DEFAULT 'none',
  ADD CONSTRAINT "rules_final_format_valid" CHECK ("final_format" IN ('none', 'rank', 'cross', 'bracket'));

ALTER TABLE "tournio"."matches"
  ALTER COLUMN "pool_id" DROP NOT NULL,
  ADD COLUMN "phase" VARCHAR(5) NOT NULL DEFAULT 'POOL',
  ADD COLUMN "final_round" INTEGER,
  ADD COLUMN "place_from" INTEGER,
  ADD COLUMN "place_to" INTEGER,
  ADD COLUMN "slot" INTEGER,
  -- Un match de poule a une poule et aucune donnée de classement ; un match de classement l’inverse.
  ADD CONSTRAINT "match_phase_consistent" CHECK (
    ("phase" = 'POOL' AND "pool_id" IS NOT NULL AND "final_round" IS NULL AND "place_from" IS NULL AND "place_to" IS NULL AND "slot" IS NULL)
    OR ("phase" = 'FINAL' AND "pool_id" IS NULL AND "final_round" >= 1 AND "place_from" >= 1 AND "place_to" > "place_from" AND "slot" >= 0)
  ),
  -- Les clés d’appartenance à une poule ne s’appliquent pas sans poule : les équipes doivent au moins appartenir au tournoi.
  ADD CONSTRAINT "matches_home_team_fkey" FOREIGN KEY ("tournament_id", "home_team_id") REFERENCES "tournio"."teams"("tournament_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "matches_away_team_fkey" FOREIGN KEY ("tournament_id", "away_team_id") REFERENCES "tournio"."teams"("tournament_id", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Un même tour ne peut pas être généré deux fois.
CREATE UNIQUE INDEX "match_final_slot_unique" ON "tournio"."matches" ("tournament_id", "final_round", "place_from", "slot") WHERE "phase" = 'FINAL';

-- Un match de classement doit désigner un vainqueur, même si les nuls sont permis en poule.
CREATE OR REPLACE FUNCTION tournio.validate_match_result() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND NEW.home_score = NEW.away_score AND (NEW.phase = 'FINAL' OR EXISTS (SELECT 1 FROM tournio.tournament_rules r WHERE r.tournament_id = NEW.tournament_id AND NOT r.allow_draw)) THEN RAISE EXCEPTION 'DRAW_NOT_ALLOWED' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
