import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// postgres-js connects lazily (only on the first query), so importing `db` never
// opens a connection. The only thing that must not blow up at build time is the
// missing DATABASE_URL: during `next build` (NEXT_PHASE set) we fall back to a
// placeholder connection string so the module - and the Auth.js Drizzle adapter,
// which type-checks a real drizzle instance - can load. The DB-backed pages render
// dynamically at request time, so nothing actually queries the placeholder.
// At runtime, DATABASE_URL is required.
const isBuild = process.env.NEXT_PHASE === "phase-production-build";
const connectionString =
  process.env.DATABASE_URL ??
  (isBuild ? "postgres://placeholder:placeholder@127.0.0.1:5432/placeholder" : undefined);

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
