/**
 * Database connection for the API gateway.
 * Read-only access to the data written by ingestion/pricing services.
 */

import postgres from "postgres";

export type Sql = postgres.Sql;

export function createDb(connectionString: string): Sql {
  return postgres(connectionString, {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
  });
}
