import { describe, it, expect } from "vitest";
import { scrypt as _scrypt } from "crypto";
import { promisify } from "util";
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  burnVerificationTime,
  CURRENT_PARAMS,
} from "./password";

const scrypt = promisify(_scrypt);

describe("hashPassword", () => {
  it("emits the parameterised format", async () => {
    const hash = await hashPassword("korrekt-hast-batteri-hafta");
    const { N, r, p } = CURRENT_PARAMS;
    expect(hash.split("$")).toHaveLength(6);
    expect(hash.startsWith(`scrypt$${N}$${r}$${p}$`)).toBe(true);
  });

  it("salts every hash separately", async () => {
    const a = await hashPassword("samma-losenord");
    const b = await hashPassword("samma-losenord");
    expect(a).not.toBe(b);
    expect(await verifyPassword("samma-losenord", a)).toBe(true);
    expect(await verifyPassword("samma-losenord", b)).toBe(true);
  });
});

describe("verifyPassword", () => {
  it("accepts the right password and rejects everything else", async () => {
    const hash = await hashPassword("korrekt-hast-batteri-hafta");
    expect(await verifyPassword("korrekt-hast-batteri-hafta", hash)).toBe(true);
    expect(await verifyPassword("fel-losenord", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  // Hashes written before the parameters were versioned must keep working -
  // otherwise raising the cost would lock existing accounts out.
  it("still verifies the legacy scrypt$salt$hash format", async () => {
    const salt = Buffer.alloc(16, 7);
    const derived = (await scrypt("gammalt-losen", salt, 64)) as Buffer;
    const legacy = `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
    expect(await verifyPassword("gammalt-losen", legacy)).toBe(true);
    expect(await verifyPassword("annat", legacy)).toBe(false);
  });

  it.each([
    "",
    "x",
    "scrypt$",
    "scrypt$a$b$c$d",
    "bcrypt$1$2$3$4$5",
    "scrypt$0$8$3$aa$bb",
    "scrypt$99999999$8$3$aa$bb", // absurd N - must not allocate
    "scrypt$32768$8$3$$",
    "scrypt$abc$8$3$aa$bb",
  ])("rejects malformed stored hash %j without throwing", async (stored) => {
    await expect(verifyPassword("nagot", stored)).resolves.toBe(false);
  });
});

describe("needsRehash", () => {
  it("is false for a fresh hash and true for a weaker one", async () => {
    expect(needsRehash(await hashPassword("x"))).toBe(false);
    expect(needsRehash("scrypt$16384$8$1$aa$bb")).toBe(true);
    expect(needsRehash("scrypt$aa$bb")).toBe(true);
    expect(needsRehash("garbage")).toBe(true);
  });
});

describe("burnVerificationTime", () => {
  // Guards against user enumeration: an unknown email must cost the same as a
  // known one with a wrong password.
  it("costs roughly as much as a real verification", async () => {
    const hash = await hashPassword("korrekt-hast-batteri-hafta");

    const t0 = Date.now();
    await burnVerificationTime("nagot");
    const decoy = Date.now() - t0;

    const t1 = Date.now();
    await verifyPassword("fel", hash);
    const real = Date.now() - t1;

    expect(decoy).toBeGreaterThan(real * 0.5);
    expect(decoy).toBeLessThan(real * 2);
  });
});
