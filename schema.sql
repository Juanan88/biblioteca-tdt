CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  isbn TEXT,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  author TEXT,
  description TEXT,
  cover_url TEXT,
  genre TEXT,
  audience TEXT CHECK (audience IS NULL OR audience IN ('infantil','juvenil','adultos')),
  min_age INTEGER CHECK (min_age IS NULL OR (min_age >= 0 AND min_age <= 120)),
  condition TEXT CHECK (condition IS NULL OR condition IN ('nuevo','bueno','aceptable','deteriorado')),
  donor_name TEXT NOT NULL DEFAULT 'Anónimo',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','borrowed','review')),
  borrower_alias TEXT,
  borrowed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  removed_at TEXT,
  CHECK (status != 'borrowed' OR (borrower_alias IS NOT NULL AND borrowed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS books_title ON books(title);
CREATE INDEX IF NOT EXISTS books_public ON books(removed_at, created_at);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL,
  action TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS events_recent ON events(id DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  action TEXT NOT NULL,
  actor_hash TEXT NOT NULL,
  hour_bucket TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(action, actor_hash, hour_bucket)
);

-- Historial sin alias antiguos. Instalación compatible con bibliotecas ya existentes.
CREATE TABLE IF NOT EXISTS book_revisions (id INTEGER PRIMARY KEY AUTOINCREMENT,book_id TEXT NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL,changed_at TEXT NOT NULL DEFAULT (datetime('now')));

CREATE INDEX IF NOT EXISTS book_revisions_by_book ON book_revisions(book_id,id DESC);

CREATE TRIGGER IF NOT EXISTS books_track_revision AFTER UPDATE ON books FOR EACH ROW WHEN OLD.isbn IS NOT NEW.isbn OR OLD.title IS NOT NEW.title OR OLD.author IS NOT NEW.author OR OLD.description IS NOT NEW.description OR OLD.cover_url IS NOT NEW.cover_url OR OLD.genre IS NOT NEW.genre OR OLD.audience IS NOT NEW.audience OR OLD.min_age IS NOT NEW.min_age OR OLD.condition IS NOT NEW.condition OR OLD.status IS NOT NEW.status OR OLD.removed_at IS NOT NEW.removed_at BEGIN INSERT INTO book_revisions(book_id,before_json,after_json) VALUES(OLD.id,json_object('isbn',OLD.isbn,'title',OLD.title,'author',OLD.author,'description',OLD.description,'cover_url',OLD.cover_url,'genre',OLD.genre,'audience',OLD.audience,'min_age',OLD.min_age,'condition',OLD.condition,'status',OLD.status,'removed_at',OLD.removed_at),json_object('isbn',NEW.isbn,'title',NEW.title,'author',NEW.author,'description',NEW.description,'cover_url',NEW.cover_url,'genre',NEW.genre,'audience',NEW.audience,'min_age',NEW.min_age,'condition',NEW.condition,'status',NEW.status,'removed_at',NEW.removed_at)); END;

-- Registra también cambios del nombre del donante, sin datos históricos de prestatarios.
CREATE TRIGGER IF NOT EXISTS books_track_donor_revision AFTER UPDATE OF donor_name ON books FOR EACH ROW WHEN OLD.donor_name IS NOT NEW.donor_name BEGIN INSERT INTO book_revisions(book_id,before_json,after_json) VALUES(OLD.id,json_object('isbn',OLD.isbn,'title',OLD.title,'author',OLD.author,'description',OLD.description,'cover_url',OLD.cover_url,'genre',OLD.genre,'audience',OLD.audience,'min_age',OLD.min_age,'condition',OLD.condition,'status',OLD.status,'removed_at',OLD.removed_at,'donor_name',OLD.donor_name),json_object('isbn',NEW.isbn,'title',NEW.title,'author',NEW.author,'description',NEW.description,'cover_url',NEW.cover_url,'genre',NEW.genre,'audience',NEW.audience,'min_age',NEW.min_age,'condition',NEW.condition,'status',NEW.status,'removed_at',NEW.removed_at,'donor_name',NEW.donor_name)); END;
