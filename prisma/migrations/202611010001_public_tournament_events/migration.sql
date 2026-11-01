BEGIN;

-- Signale toute modification d’un tournoi ou de ses matchs. La charge utile ne contient que
-- l’identifiant du tournoi : les clients publics rechargent ensuite un instantané filtré.
-- PostgreSQL fusionne les notifications identiques d’une même transaction (un seul message par commit).
CREATE FUNCTION tournio.notify_tournament_change() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE target uuid;
BEGIN
  IF TG_TABLE_NAME = 'tournaments' THEN target := COALESCE(NEW.id, OLD.id);
  ELSE target := COALESCE(NEW.tournament_id, OLD.tournament_id);
  END IF;
  PERFORM pg_catalog.pg_notify('tournio_tournaments', json_build_object('id', target)::text);
  RETURN NULL;
END $$;

CREATE TRIGGER tournament_changed AFTER UPDATE ON tournio.tournaments
  FOR EACH ROW EXECUTE FUNCTION tournio.notify_tournament_change();
CREATE TRIGGER match_changed AFTER INSERT OR UPDATE OR DELETE ON tournio.matches
  FOR EACH ROW EXECUTE FUNCTION tournio.notify_tournament_change();

COMMIT;
