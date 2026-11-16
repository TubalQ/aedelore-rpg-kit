import { describe, it, expect } from "vitest";
import { validatePassword, MIN_PASSWORD_LENGTH } from "./password-policy";

describe("validatePassword", () => {
  it.each([
    ["kort", "too short"],
    ["password", "too short, and common"],
    ["Password1234", "common word with trailing digits"],
    ["P@ssw0rd2024", "leetspeak plus a year"],
    ["passwordpassword", "common word padded to length"],
    ["losenord1234", "Swedish common word"],
    ["aedelore1234", "the site's own name"],
    ["Aedelore2026!", "site name with decoration"],
    ["l0senord!!!!", "leetspeak Swedish"],
    ["qwertyuiop12", "keyboard run"],
    ["1234567890ab", "digit run"],
    ["aaaaaaaaaaaa", "one repeated character"],
    ["abababababab", "repeated pair"],
    ["123123123123", "repeated triple"],
  ])("rejects %j (%s)", (password) => {
    expect(validatePassword(password)).not.toBeNull();
  });

  it.each([
    "korrekt-hast-batteri-hafta",
    "Vindarna over Aedelore 1823",
    "tre kaniper i en hatt",
    "xK9#mQ2vLp4wZn8t",
    "Draken sov i berget 1823",
  ])("accepts %j", (password) => {
    expect(validatePassword(password)).toBeNull();
  });

  it("rejects a password built from the user's own email or name", () => {
    expect(validatePassword("annaharettlangtlosen", ["anna@exempel.se"])).not.toBeNull();
    expect(validatePassword("bertilssonlosenord", ["Bertilsson"])).not.toBeNull();
    // Someone else's name is fine.
    expect(validatePassword("mittvanligalosen42", ["bertil@exempel.se"])).toBeNull();
  });

  it("states the length requirement in the message", () => {
    expect(validatePassword("kort")).toBe("passwordTooShort");
    expect(MIN_PASSWORD_LENGTH).toBe(12);
  });

  it("rejects absurdly long input rather than hashing it", () => {
    expect(validatePassword("a".repeat(5000))).not.toBeNull();
  });
});
