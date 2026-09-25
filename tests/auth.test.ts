import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../lib/auth";

test("password hashes use a salted scheme and verify only the original password", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");

  assert.match(first, /^pbkdf2\$310000\$/);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("correct horse battery staple", first), true);
  assert.equal(await verifyPassword("incorrect password", first), false);
});

test("password verification rejects malformed or unsafe hash parameters", async () => {
  assert.equal(await verifyPassword("password", "not-a-password-hash"), false);
  assert.equal(await verifyPassword("password", "pbkdf2$999999999$00112233445566778899aabbccddeeff$0011"), false);
});
