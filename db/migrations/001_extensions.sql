-- 001: Enable required Postgres extensions.
-- TimescaleDB for time-series hypertables, pgcrypto for UUIDs.

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
