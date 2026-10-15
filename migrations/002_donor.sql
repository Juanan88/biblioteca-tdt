-- SOLO si la columna aún no existe: la aplicación ejecuta estos cambios automáticamente.
-- Para bases creadas antes, esta ALTER no borra libros ni préstamos.
ALTER TABLE books ADD COLUMN donor_name TEXT NOT NULL DEFAULT 'Anónimo';

-- Tras ejecutar la migración de historial 001 (o la primera escritura).
CREATE TRIGGER IF NOT EXISTS books_track_donor_revision AFTER UPDATE OF donor_name ON books FOR EACH ROW WHEN OLD.donor_name IS NOT NEW.donor_name BEGIN INSERT INTO book_revisions(book_id,before_json,after_json) VALUES(OLD.id,json_object('isbn',OLD.isbn,'title',OLD.title,'author',OLD.author,'description',OLD.description,'cover_url',OLD.cover_url,'genre',OLD.genre,'audience',OLD.audience,'min_age',OLD.min_age,'condition',OLD.condition,'status',OLD.status,'removed_at',OLD.removed_at,'donor_name',OLD.donor_name),json_object('isbn',NEW.isbn,'title',NEW.title,'author',NEW.author,'description',NEW.description,'cover_url',NEW.cover_url,'genre',NEW.genre,'audience',NEW.audience,'min_age',NEW.min_age,'condition',NEW.condition,'status',NEW.status,'removed_at',NEW.removed_at,'donor_name',NEW.donor_name)); END;
