// Mirrors references/db-schema/SQLite_Schema.sql. Keep both in sync.
export const SCHEMA_SQL = `
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
    id               TEXT PRIMARY KEY,
    baby_id          TEXT NOT NULL,
    weight_kg        REAL NOT NULL CHECK (weight_kg > 0),
    measurement_date TEXT NOT NULL,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
    deleted_at       INTEGER,
    server_version   INTEGER NOT NULL DEFAULT 0 CHECK (server_version >= 0),
    FOREIGN KEY (baby_id) REFERENCES babies(id) ON DELETE CASCADE
);

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
`;
