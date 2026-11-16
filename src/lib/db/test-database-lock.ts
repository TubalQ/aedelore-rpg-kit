import postgres from "postgres";

// Test files against the throwaway database (*.db.test.ts) empty its tables,
// and vitest runs files in parallel. Each such file holds this lock for its
// whole run, so they take turns. The lock lives on a connection of its own:
// a session-level advisory lock must be released on the connection that took it.

const LOCK_KEY = 4_250_101;

/** Waits for the test database, and returns the function that releases it. */
export async function lockTestDatabase(url: string): Promise<() => Promise<void>> {
  const conn = postgres(url, { max: 1 });
  await conn`SELECT pg_advisory_lock(${LOCK_KEY})`;
  return async () => {
    await conn`SELECT pg_advisory_unlock(${LOCK_KEY})`;
    await conn.end();
  };
}
