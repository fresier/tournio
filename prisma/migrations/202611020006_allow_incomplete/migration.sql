-- Groupe incomplet autorisé en phase de classement : les dernières équipes du classement général jouent un match de moins.
ALTER TABLE "tournio"."tournament_rules" ADD COLUMN "allow_incomplete" BOOLEAN NOT NULL DEFAULT false;
