CREATE TABLE IF NOT EXISTS logs_db.logs (
    id          UUID            DEFAULT generateUUIDv4(),
    timestamp   DateTime64(3, 'UTC') DEFAULT now64(3),
    user_id     String,
    level       LowCardinality(String) DEFAULT 'info',
    message     String,
    body        String,
    service     String          DEFAULT '',
    metadata    String          DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, user_id)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;