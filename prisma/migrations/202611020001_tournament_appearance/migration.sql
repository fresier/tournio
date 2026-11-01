-- Couleurs personnalisées d’un tournoi (pages publiques). NULL = couleurs Tournio par défaut.
ALTER TABLE "tournio"."tournaments"
  ADD COLUMN "primary_color" VARCHAR(7),
  ADD COLUMN "accent_color" VARCHAR(7),
  ADD CONSTRAINT "tournaments_primary_color_hex" CHECK ("primary_color" IS NULL OR "primary_color" ~ '^#[0-9a-f]{6}$'),
  ADD CONSTRAINT "tournaments_accent_color_hex" CHECK ("accent_color" IS NULL OR "accent_color" ~ '^#[0-9a-f]{6}$');
