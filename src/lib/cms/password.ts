import "server-only";

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const PREFIX = "scrypt";

/**
 * The parts are joined with ":" and never "$".
 *
 * This value lives in a .env file, and Next expands environment variables when
 * it loads those — a "$" followed by word characters is replaced by whatever
 * that variable holds, which is usually nothing. A hash written with "$"
 * separators silently arrives at the application shortened and unusable, and
 * the only symptom is that the correct password stops being accepted. Base64
 * never produces a colon, so this separator is unambiguous and inert.
 */
const SEP = ":";

/**
 * Hashing and verification for the one shared CMS password.
 *
 * scrypt rather than a plain digest: the password is short, human-chosen and
 * shared, so the only thing standing between a leaked hash and the password
 * itself is how expensive each guess is. Node's scrypt is deliberately slow and
 * memory-hard, which is what makes a wordlist attack impractical.
 *
 * Comparison is timing-safe. A fast `===` leaks, through how long it takes to
 * fail, roughly how much of a guess was correct — enough to recover a secret one
 * character at a time given sufficient attempts.
 */

/** Produces the value that belongs in CMS_PASSWORD_HASH. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return [PREFIX, salt.toString("base64"), key.toString("base64")].join(SEP);
}

/**
 * True only if `password` produced `stored`.
 *
 * Returns false rather than throwing on a malformed stored hash: a
 * misconfigured deployment must fail closed, never open.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(SEP);
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[1], "base64");
    expected = Buffer.from(parts[2], "base64");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH || salt.length === 0) return false;

  const actual = await scrypt(password, salt, KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}
