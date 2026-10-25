-- Feedla | SQLite offline-first schema
-- Times: UTC Unix epoch milliseconds (INTEGER)
-- Calendar dates: YYYY-MM-DD (TEXT)
-- IDs: UUID strings generated on-device
-- Pee / poop: NULL = not recorded, 1..5 = recorded level
-- Bath: 0 = not recorded, 1 = recorded
-- Enable foreign keys on EVERY SQLite connection.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    display_name TEXT
);

CREATE TABLE IF NOT EXISTS babies (
    id                            TEXT PRIMARY KEY,
    owner_user_id                 TEXT,
    name                          TEXT NOT NULL,
    date_of_birth                 TEXT NOT NULL,
    created_at                    INTEGER NOT NULL,
    updated_at                    INTEGER NOT NULL,
    deleted_at                    INTEGER,
    server_version                INTEGER NOT NULL DEFAULT 0 CHECK (server_version >= 0),
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Local cache of membership. Cloud backend enforces actual permissions.
CREATE TABLE IF NOT EXISTS baby_members (
    baby_id    TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    role       TEXT NOT NULL CHECK (role IN ('owner', 'caregiver')),
    joined_at  INTEGER NOT NULL,
    PRIMARY KEY (baby_id, user_id),
    FOREIGN KEY (baby_id) REFERENCES babies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weights (
    id              TEXT PRIMARY KEY,
    baby_id         TEXT NOT NULL,
    weight_kg       REAL NOT NULL CHECK (weight_kg > 0),
    measurement_date TEXT NOT NULL,  -- YYYY-MM-DD
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    deleted_at      INTEGER,
    server_version  INTEGER NOT NULL DEFAULT 0 CHECK (server_version >= 0),
    FOREIGN KEY (baby_id) REFERENCES babies(id) ON DELETE CASCADE
);

-- One record may contain ANY combination of milk, pee, poop, and bath.
CREATE TABLE IF NOT EXISTS activities (
    id                 TEXT PRIMARY KEY,
    baby_id            TEXT NOT NULL,
    milk_ml            INTEGER CHECK (milk_ml IS NULL OR milk_ml > 0),
    pee_level          INTEGER CHECK (pee_level IS NULL OR pee_level BETWEEN 1 AND 5),
    poop_level         INTEGER CHECK (poop_level IS NULL OR poop_level BETWEEN 1 AND 5),
    bath               INTEGER NOT NULL DEFAULT 0 CHECK (bath IN (0, 1)),
    occurred_at        INTEGER NOT NULL,
    created_by_user_id TEXT,
    updated_by_user_id TEXT,
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL,
    deleted_at         INTEGER,
    server_version     INTEGER NOT NULL DEFAULT 0 CHECK (server_version >= 0),
    CHECK (milk_ml IS NOT NULL OR pee_level IS NOT NULL OR poop_level IS NOT NULL OR bath = 1),
    FOREIGN KEY (baby_id) REFERENCES babies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Sync engine reads this queue; save business row and queue operation in ONE transaction.
-- UNIQUE(entity_type, entity_id) collapses multiple pending edits to the same row.
CREATE TABLE IF NOT EXISTS sync_outbox (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type   TEXT NOT NULL CHECK (entity_type IN ('baby', 'weight', 'activity')),
    entity_id     TEXT NOT NULL,
    operation     TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
    base_version  INTEGER NOT NULL DEFAULT 0 CHECK (base_version >= 0),
    queued_at     INTEGER NOT NULL,
    attempts      INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_error    TEXT,
    UNIQUE(entity_type, entity_id)
);

-- Opaque server cursor for incremental sync of each shared baby profile.
CREATE TABLE IF NOT EXISTS sync_cursors (
    baby_id        TEXT PRIMARY KEY,
    cursor         TEXT,
    last_synced_at INTEGER,
    FOREIGN KEY (baby_id) REFERENCES babies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activities_baby_time
    ON activities (baby_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_baby_feed_time
    ON activities (baby_id, occurred_at DESC) WHERE deleted_at IS NULL AND milk_ml IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_baby_bath_time
    ON activities (baby_id, occurred_at DESC) WHERE deleted_at IS NULL AND bath = 1;
CREATE INDEX IF NOT EXISTS idx_weights_baby_date
    ON weights (baby_id, measurement_date DESC, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sync_outbox_queue
    ON sync_outbox (queued_at);

-- EXAMPLE: insert one combined activity record, with a server-independent UUID.
-- All :parameters below are bound by the React Native application.
-- BEGIN;
-- INSERT INTO activities (
--   id, baby_id, milk_ml, pee_level, poop_level, bath,
--   occurred_at, created_at, updated_at, created_by_user_id
-- ) VALUES (
--   :activity_id, :baby_id, 120, 3, 2, 1,
--   :now_ms, :now_ms, :now_ms, :user_id
-- );
-- INSERT INTO sync_outbox (entity_type, entity_id, operation, queued_at)
-- VALUES ('activity', :activity_id, 'upsert', :now_ms);
-- COMMIT;

-- EXAMPLE: daily summary using local-day start/end converted to UTC milliseconds.
-- SELECT
--   COALESCE(SUM(milk_ml), 0) AS milk_ml_total,
--   SUM(CASE WHEN milk_ml IS NOT NULL THEN 1 ELSE 0 END) AS feed_count,
--   SUM(CASE WHEN pee_level IS NOT NULL THEN 1 ELSE 0 END) AS pee_count,
--   SUM(CASE WHEN poop_level IS NOT NULL THEN 1 ELSE 0 END) AS poop_count,
--   SUM(CASE WHEN bath = 1 THEN 1 ELSE 0 END) AS bath_count
-- FROM activities
-- WHERE baby_id = :baby_id AND deleted_at IS NULL
--   AND occurred_at >= :start_ms AND occurred_at < :end_ms;
