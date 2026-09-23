#!/usr/bin/env node
/**
 * Turns a chosen CMS password into the value that belongs in CMS_PASSWORD_HASH.
 *
 *     node scripts/hash-cms-password.mjs
 *
 * It reads the password from a prompt rather than an argument on purpose: an
 * argument would be visible to anyone running `ps`, and would be written into
 * the shell history file in clear text.
 *
 * The password itself is never stored anywhere by this script. Only the hash is
 * printed, and only the hash goes into the environment.
 */
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline";

const scrypt = promisify(scryptCb);

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // Suppress echo so the password does not appear on screen.
  const onData = (char) => {
    if (["\n", "\r", ""].includes(char.toString("utf8"))) {
      process.stdin.removeListener("data", onData);
    } else {
      process.stdout.write("[2K[200D" + question + "*".repeat(rl.line.length));
    }
  };
  process.stdin.on("data", onData);
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    process.stdout.write("\n");
    resolve(answer);
  }));
}

const password = await ask("Choose the CMS password: ");
if (!password || password.length < 12) {
  console.error("\nToo short. Use at least 12 characters — this one password is the only thing protecting the management area, and everyone who manages the site shares it.");
  process.exit(1);
}
const confirm = await ask("Type it again: ");
if (password !== confirm) {
  console.error("\nThose did not match. Nothing was written.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await scrypt(password, salt, 64);

console.log("\nAdd this line to .env.local (and to the Vercel environment for production):\n");
console.log(`CMS_PASSWORD_HASH=scrypt:${salt.toString("base64")}:${key.toString("base64")}`);
console.log("\nThe password itself is not stored anywhere. Keep it in the school's password manager.");
