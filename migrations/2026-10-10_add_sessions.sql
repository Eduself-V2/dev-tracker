-- Persist login sessions in MySQL instead of API server memory, so users stay
-- logged in across restarts. `expires` is a Unix timestamp in seconds.
CREATE TABLE IF NOT EXISTS sessions (
  sid varchar(128) NOT NULL,
  expires int unsigned NOT NULL,
  data mediumtext NOT NULL,
  PRIMARY KEY (sid),
  KEY idx_sessions_expires (expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
