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
