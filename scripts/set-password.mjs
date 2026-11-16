#!/usr/bin/env node
/**
 * Set or reset an account's password (self-hosted kit, AUTH_PASSWORD_ENABLED).
 * The password is read from stdin, never from the command line (shell history).
 *
 *   echo -n 'new password here' | docker compose run --rm -T --entrypoint node init scripts/set-password.mjs you@example.com
 *
 * Also gives a password to an account made through OIDC. Every session of the
 * account ends at its next request. The hash format is the app's own
 * (src/lib/auth/password.ts); a test keeps the two in step.
 */
import { randomBytes, scrypt } from "crypto";
import { fileURLToPath } from "url";
import postgres from "postgres";

const PARAMS = { N: 32768, r: 8, p: 3 };
const MIN_LENGTH = 12;

export function hashPasswordCli(password) {
  const salt = randomBytes(16);
  const { N, r, p } = PARAMS;
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N, r, p, maxmem: 128 * N * r * 2 }, (err, key) => {
      if (err) reject(err);
      else resolve(["scrypt", N, r, p, salt.toString("hex"), key.toString("hex")].join("$"));
    });
  });
}

async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, "");
}

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email) throw new Error("Usage: node scripts/set-password.mjs <email>  (password on stdin)");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const password = await readStdin();
  if (password.length < MIN_LENGTH) throw new Error(`The password must be at least ${MIN_LENGTH} characters`);

  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const hash = await hashPasswordCli(password);
    const rows = await sql`update users set password_hash = ${hash} where lower(email) = ${email} and deleted_at is null returning id`;
    if (rows.length === 0) throw new Error(`No account with the email ${email}`);
    console.log(`Password set for ${email}.`);
  } finally {
    await sql.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
