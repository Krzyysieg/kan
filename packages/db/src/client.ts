import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePgLite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";

import { createLogger } from "@kan/logger";

import * as schema from "./schema";

const log = createLogger("db");

export type dbClient = NodePgDatabase<typeof schema> & {
  $client: Pool;
};

// Cache the client on globalThis so a single connection pool is reused across
// requests (and survives Next.js dev HMR reloads). Creating a new Pool per
// request forces a fresh TLS handshake to the database (~300ms to a remote
// host like Neon) on every call and leaks connections, which makes every API
// request slow.
const globalForDb = globalThis as unknown as {
  __kanDbClient?: dbClient;
};

const buildDrizzleClient = (): dbClient => {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    log.warn("POSTGRES_URL not set, falling back to PGLite");

    const client = new PGlite({
      dataDir: "./pgdata",
      extensions: { uuid_ossp },
    });
    const db = drizzlePgLite(client, { schema });

    migrate(db, { migrationsFolder: "../../packages/db/migrations" });

    return db as unknown as dbClient;
  }

  const pool = new Pool({
    connectionString,
  });

  return drizzlePg(pool, { schema }) as dbClient;
};

export const createDrizzleClient = (): dbClient => {
  return (globalForDb.__kanDbClient ??= buildDrizzleClient());
};
