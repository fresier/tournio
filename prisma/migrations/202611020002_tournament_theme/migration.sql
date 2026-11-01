-- Thème préconfiguré des pages publiques (fond, cartes, texte). La liste des thèmes est validée par l’application.
ALTER TABLE "tournio"."tournaments"
  ADD COLUMN "theme" VARCHAR(20) NOT NULL DEFAULT 'tournio',
  ADD CONSTRAINT "tournaments_theme_format" CHECK ("theme" ~ '^[a-z]{1,20}$');
