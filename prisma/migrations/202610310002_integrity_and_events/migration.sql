BEGIN;

ALTER TABLE tournio.tournaments
  ADD CONSTRAINT tournament_name_valid CHECK (length(trim(name)) >= 2),
  ADD CONSTRAINT tournament_sport_valid CHECK (length(trim(sport)) >= 2),
  ADD CONSTRAINT tournament_slug_valid CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT tournament_dates_valid CHECK (ends_at > starts_at),
  ADD CONSTRAINT tournament_version_valid CHECK (version > 0),
  ADD CONSTRAINT tournament_publication_valid CHECK ((status = 'DRAFT' AND published_at IS NULL) OR (status <> 'DRAFT' AND published_at IS NOT NULL));

ALTER TABLE tournio.tournament_rules
  ADD CONSTRAINT rules_durations_valid CHECK (match_duration_minutes > 0 AND transition_minutes >= 0 AND minimum_rest_minutes >= 0),
  ADD CONSTRAINT rules_points_valid CHECK (points_win BETWEEN -999 AND 999 AND points_draw BETWEEN -999 AND 999 AND points_loss BETWEEN -999 AND 999),
  ADD CONSTRAINT rules_tie_break_valid CHECK (tie_break_order = ARRAY['points','score_difference','scores_for','team_id']);
ALTER TABLE tournio.teams
  ADD CONSTRAINT team_name_valid CHECK (length(trim(name)) >= 2),
  ADD CONSTRAINT team_slug_valid CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE tournio.pools ADD CONSTRAINT pool_name_valid CHECK (length(trim(name)) >= 2);
ALTER TABLE tournio.courts ADD CONSTRAINT court_name_valid CHECK (length(trim(name)) >= 2);
ALTER TABLE tournio.court_availabilities ADD CONSTRAINT court_availability_dates_valid CHECK (ends_at > starts_at);
ALTER TABLE tournio.matches
  ADD CONSTRAINT match_distinct_teams CHECK (home_team_id <> away_team_id),
  ADD CONSTRAINT match_assignment_complete CHECK ((court_id IS NULL AND starts_at IS NULL AND ends_at IS NULL) OR (court_id IS NOT NULL AND starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at > starts_at)),
  ADD CONSTRAINT match_postponed_unassigned CHECK (status <> 'POSTPONED' OR starts_at IS NULL),
  ADD CONSTRAINT match_score_nonnegative CHECK (home_score >= 0 AND away_score >= 0),
  ADD CONSTRAINT match_result_valid CHECK ((status = 'COMPLETED' AND home_score IS NOT NULL AND away_score IS NOT NULL AND result_validated_at IS NOT NULL) OR (status <> 'COMPLETED' AND home_score IS NULL AND away_score IS NULL AND result_validated_at IS NULL)),
  ADD CONSTRAINT match_version_valid CHECK (version > 0);
CREATE UNIQUE INDEX match_unique_pair ON tournio.matches(tournament_id, pool_id, LEAST(home_team_id, away_team_id), GREATEST(home_team_id, away_team_id));
ALTER TABLE tournio.demo_matches
  ADD CONSTRAINT demo_score_valid CHECK (home_score BETWEEN 0 AND 999 AND away_score BETWEEN 0 AND 999),
  ADD CONSTRAINT demo_version_valid CHECK (version > 0);

CREATE FUNCTION tournio.validate_tournament_values() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.timezone) THEN RAISE EXCEPTION 'INVALID_TIMEZONE' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM tournio.court_availabilities a WHERE a.tournament_id = NEW.id AND (a.starts_at < NEW.starts_at OR a.ends_at > NEW.ends_at)) THEN RAISE EXCEPTION 'AVAILABILITY_OUTSIDE_TOURNAMENT' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tournament_values BEFORE INSERT OR UPDATE ON tournio.tournaments FOR EACH ROW EXECUTE FUNCTION tournio.validate_tournament_values();

CREATE FUNCTION tournio.validate_availability() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE tournament_start timestamptz; tournament_end timestamptz;
BEGIN
  -- Sérialiser aussi les insertions SQL directes d’un même terrain.
  PERFORM 1 FROM tournio.courts WHERE id = NEW.court_id FOR UPDATE;
  SELECT starts_at, ends_at INTO tournament_start, tournament_end FROM tournio.tournaments WHERE id = NEW.tournament_id;
  IF NEW.starts_at < tournament_start OR NEW.ends_at > tournament_end THEN RAISE EXCEPTION 'AVAILABILITY_OUTSIDE_TOURNAMENT' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM tournio.court_availabilities a WHERE a.court_id = NEW.court_id AND a.id <> NEW.id AND a.starts_at < NEW.ends_at AND a.ends_at > NEW.starts_at) THEN RAISE EXCEPTION 'AVAILABILITY_OVERLAP' USING ERRCODE = '23P01'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER availability_values BEFORE INSERT OR UPDATE ON tournio.court_availabilities FOR EACH ROW EXECUTE FUNCTION tournio.validate_availability();

CREATE FUNCTION tournio.validate_match_result() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND NEW.home_score = NEW.away_score AND EXISTS (SELECT 1 FROM tournio.tournament_rules r WHERE r.tournament_id = NEW.tournament_id AND NOT r.allow_draw) THEN RAISE EXCEPTION 'DRAW_NOT_ALLOWED' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER match_result_values BEFORE INSERT OR UPDATE ON tournio.matches FOR EACH ROW EXECUTE FUNCTION tournio.validate_match_result();

CREATE FUNCTION tournio.notify_demo_match() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_notify('tournio_demo_matches', json_build_object('id', NEW.id)::text);
  RETURN NEW;
END $$;
CREATE TRIGGER demo_match_updated AFTER UPDATE ON tournio.demo_matches FOR EACH ROW EXECUTE FUNCTION tournio.notify_demo_match();
REVOKE ALL ON SCHEMA tournio FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA tournio FROM PUBLIC;
COMMIT;
