import { cookies } from "next/headers";
import { verifyToken, type SessionUser } from "./session";

export { createToken, verifyToken } from "./session";
export type { SessionUser } from "./session";

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" }, key, 256);
  const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `pbkdf2$310000$${hex(salt)}$${hex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const [scheme, iterationsText, saltText, hashText] = hashedPassword.split("$");
  const equalBytes = (left: Uint8Array, right: Uint8Array) => {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
    return difference === 0;
  };

  if (hashedPassword.length === 64 && /^[a-f\d]+$/i.test(hashedPassword)) {
    const legacy = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    const expected = new Uint8Array(hashedPassword.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));
    return equalBytes(new Uint8Array(legacy), expected);
  }
  if (scheme !== "pbkdf2" || !iterationsText || !saltText || !hashText) return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
  if (!/^[a-f\d]{32}$/i.test(saltText) || !/^[a-f\d]{64}$/i.test(hashText)) return false;
  const fromHex = (value: string) => new Uint8Array(value.match(/.{2}/g)?.map((pair) => parseInt(pair, 16)) ?? []);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromHex(saltText), iterations, hash: "SHA-256" }, key, 256);
  const actual = new Uint8Array(bits);
  const expected = fromHex(hashText);
  return equalBytes(actual, expected);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
}
