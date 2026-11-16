// Password strength rules, following NIST SP 800-63B: require length, screen
// against known-weak choices, and impose no composition rules. Forcing a
// symbol and a digit demonstrably pushes people toward "Password1!" and
// variants of it, which is exactly what the blocklist below has to catch.

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

// The passwords that show up first in every credential-stuffing list, plus the
// Swedish ones an English list would miss. Compared after normalisation (see
// normalise()), so "Password123" is caught by the "password" entry.
const COMMON_PASSWORDS = new Set([
  "password", "passwd", "pass", "secret", "letmein", "welcome", "admin",
  "administrator", "root", "login", "guest", "test", "user", "default",
  "changeme", "temp", "access", "master", "manager", "superman", "batman",
  "dragon", "monkey", "shadow", "sunshine", "princess", "football", "baseball",
  "soccer", "hockey", "iloveyou", "trustno", "whatever", "freedom", "starwars",
  "computer", "internet", "samsung", "google", "facebook", "linkedin",
  "qwerty", "qwertyuiop", "asdf", "asdfgh", "asdfghjkl", "zxcvbn", "zxcvbnm",
  "qazwsx", "qwertz", "azerty", "abcdef", "abcdefg", "abcabc",
  "iloveu", "loveme", "lovely", "hello", "hallo", "hejsan", "hejhej",
  "sommar", "vinter", "hemligt", "hemlig", "losenord", "lösenord", "kodord",
  "sverige", "stockholm", "goteborg", "göteborg", "malmo", "malmö", "sverker",
  "anders", "johan", "erik", "maria", "linda", "kalle", "pelle", "olle",
  "aedelore", "aedelorenu",
  "dungeon", "dragons", "wizard", "warrior", "paladin", "rogue", "cleric",
  "gandalf", "frodo", "legolas", "aragorn", "hobbit", "mordor",
  "money", "flower", "summer", "winter", "spring", "autumn", "orange",
  "purple", "yellow", "silver", "golden", "diamond", "crystal", "phoenix",
  "ninja", "hunter", "killer", "gamer", "player", "master1", "matrix",
  "michael", "jennifer", "jordan", "harley", "ranger", "buster", "thomas",
  "robert", "daniel", "andrew", "joshua", "charlie", "ashley", "nicole",
  "chocolate", "cookie", "banana", "apple", "cheese", "coffee", "beer",
]);

// Sequences that read as "random" to the person typing them but are the first
// thing any cracker tries.
const KEYBOARD_RUNS = [
  "qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890",
  "abcdefghijklmnopqrstuvwxyz",
];

/**
 * Weak-password matching works on normalised forms of the input, so that
 * "P@ssword2024!" is measured as "password".
 *
 * Order matters: edge decoration is trimmed BEFORE leetspeak is folded. Folding
 * first would turn a trailing "1234" into letters and bury the base word.
 * Several variants are returned because no single one catches every disguise -
 * trimming the edges hides "@dmin", while folding everything distorts words
 * that legitimately contain digits.
 */
function normaliseCandidates(password: string): string[] {
  const lower = password.toLowerCase();
  const alphaOnly = (s: string) => s.replace(/[^a-zåäö]/g, "");
  const foldLeet = (s: string) =>
    s
      .replace(/[@4]/g, "a")
      .replace(/3/g, "e")
      .replace(/[1!|]/g, "i")
      .replace(/0/g, "o")
      .replace(/[$5]/g, "s")
      .replace(/7/g, "t");

  const edgeTrimmed = lower.replace(/^[^a-zåäö]+/, "").replace(/[^a-zåäö]+$/, "");

  return [
    alphaOnly(foldLeet(edgeTrimmed)), // Password1234 -> password
    alphaOnly(foldLeet(lower)), // @dmin -> admin
    alphaOnly(lower), // leaves words with digits intact
  ].filter((c) => c.length > 0);
}

/** The primary normalised form, used for substring checks. */
function normalise(password: string): string {
  return normaliseCandidates(password)[0] ?? "";
}

function hasKeyboardRun(password: string): boolean {
  const lower = password.toLowerCase();
  for (const run of KEYBOARD_RUNS) {
    for (let i = 0; i + 6 <= run.length; i++) {
      const slice = run.slice(i, i + 6);
      if (lower.includes(slice)) return true;
      if (lower.includes([...slice].reverse().join(""))) return true;
    }
  }
  return false;
}

function isRepetitive(password: string): boolean {
  // "aaaaaaaaaaaa", "abababababab", "123123123123" - a short unit repeated to
  // reach the length requirement.
  for (let unit = 1; unit <= 4; unit++) {
    if (password.length % unit !== 0) continue;
    const head = password.slice(0, unit);
    if (head.repeat(password.length / unit) === password) return true;
  }
  return new Set(password.toLowerCase()).size <= 3;
}

/** Why a password is refused; each is an API error code (error-codes.ts). */
export type PasswordProblem =
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordCommon"
  | "passwordRepetitive"
  | "passwordKeyboardRun"
  | "passwordPersonal";

/**
 * Returns why the password is unacceptable, or null when it passes.
 * `identifiers` are values the password must not simply echo - the email and
 * display name being the ones that matter.
 */
export function validatePassword(
  password: string,
  identifiers: (string | null | undefined)[] = [],
): PasswordProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return "passwordTooShort";
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return "passwordTooLong";
  }

  const candidates = normaliseCandidates(password);
  const normalised = normalise(password);

  for (const candidate of candidates) {
    if (COMMON_PASSWORDS.has(candidate)) {
      return "passwordCommon";
    }
    // Also catch a common word padded to length: "passwordpassword".
    for (const common of COMMON_PASSWORDS) {
      if (common.length >= 5 && candidate.replaceAll(common, "") === "") {
        return "passwordCommon";
      }
    }
  }

  if (isRepetitive(password)) {
    return "passwordRepetitive";
  }

  if (hasKeyboardRun(password)) {
    return "passwordKeyboardRun";
  }

  for (const raw of identifiers) {
    if (!raw) continue;
    // Compare against the email's local part too - "anna@example.com" should
    // rule out "anna" as a password base.
    for (const candidate of [raw, raw.split("@")[0]]) {
      const raw_n = normalise(candidate);
      if (raw_n.length >= 4 && normalised.includes(raw_n)) {
        return "passwordPersonal";
      }
    }
  }

  return null;
}
