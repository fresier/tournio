ALTER TABLE "tournio"."tournaments"
  ADD COLUMN "background_color" VARCHAR(7),
  ADD COLUMN "surface_color" VARCHAR(7),
  ADD COLUMN "text_color" VARCHAR(7),
  ADD CONSTRAINT "tournaments_background_color_hex" CHECK ("background_color" IS NULL OR "background_color" ~ '^#[0-9a-f]{6}$'),
  ADD CONSTRAINT "tournaments_surface_color_hex" CHECK ("surface_color" IS NULL OR "surface_color" ~ '^#[0-9a-f]{6}$'),
  ADD CONSTRAINT "tournaments_text_color_hex" CHECK ("text_color" IS NULL OR "text_color" ~ '^#[0-9a-f]{6}$'),
  ADD CONSTRAINT "tournaments_custom_theme_complete" CHECK (
    ("background_color" IS NULL AND "surface_color" IS NULL AND "text_color" IS NULL) OR
    ("background_color" IS NOT NULL AND "surface_color" IS NOT NULL AND "text_color" IS NOT NULL)
  );
